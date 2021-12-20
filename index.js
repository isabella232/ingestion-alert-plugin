export async function runEveryMinute(meta) {
    const activeAlertKey = await meta.cache.get("pagerduty_active_incident")
    const isInError = await isTrendErroring(meta)

    if (activeIncidentKey && !isInError) {
        await resolveAlert(activeAlertKey, meta)
        console.log('Resolved alert', activeAlertKey)
    } else if (!activeAlertKey && isInError) {
        const key = await triggerAlert(meta)
        console.log('Triggered alert', key)
    } else if (isInError) {
        console.log('Alert is active, ignoring for now')
    } else {
        console.log('All good! 😍')
    }
}

async function isTrendErroring(meta) {
    ///Lets just see if this zero for specified period
    const { data } = await getTrend(meta)
    return !data.slice(-2).some((value) =>
        !dataPointInError(value, parseFloat(meta.config.threshold), meta.config.operator)
    )
}

function dataPointInError(value, threshold, operator) {
    if (operator.startsWith('≤')) {
        return value <= threshold
    } else {
        return value >= threshold
    }
}

async function getTrend(meta) {
    const response = await fetch(insightsApiUrl(meta.config.posthogTrendUrl), {
        headers: {
            authorization: `Bearer ${meta.config.posthogApiKey}`
        }
    })

    if (!response.ok) {
        throw Error(`Error from PostHog API: status=${response.status} response=${await response.text()}`)
    }

    const results = await response.json()

    console.log('Got PostHog trends response', results)
    return results.result[0]
}

async function triggerAlert(meta) {
    // Trigger WebHook, set uniuque key
    await meta.cache.set("active_alert", "key") 
}

async function resolveAlert(incidentKey, meta) {
    await meta.cache.set("active_alert", null)
}

function insightsApiUrl(trendsUrl) {
    let url = new URL(trendsUrl)

    ///Lets configure this manually https://posthog.com/docs/api/insights

    url.searchParams.set('refresh', 'true')
    if (url.pathname === '/insights') {
        url = new URL(`${url.origin}/api/insight/trend${url.search}${url.hash}`)
    }

    if (!url.pathname.startsWith('/api/insight/trend')) {
        throw Error(`Not a valid trends URL: ${trendsUrl}`)
    }

    return url.href
}
