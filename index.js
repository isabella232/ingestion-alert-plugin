export async function runEveryMinute(meta) {
    const activeAlertKey = await meta.cache.get("active_alert")
    const isInError = await isNoEventsInPeriod(meta)

    if (activeAlertKey && !isInError) {
        await resolveAlert(meta)
        console.info('Resolved ingestion alert', activeAlertKey)
    } else if (!activeAlertKey && isInError) {
        const key = await triggerAlert(meta)
        console.warn('Triggered ingesion alert', key)
    } else if (isInError) {
        console.warn('Ingestion alert is already active')
    } else {
        console.log('Ingestion OK')
    }
}

async function isNoEventsInPeriod(meta) {
    const events = await getTrend(meta)
    return events.length == 0
}

async function getTrend(meta) {
    const response = await fetch(eventsApiUrl(meta.config.posthogHost, meta.config.timeRange), {
        headers: {
            authorization: `Bearer ${meta.config.posthogApiKey}`
        }
    })

    if (!response.ok) {
        throw Error(`Error from PostHog API: status=${response.status} response=${await response.text()}`)
    }

    const results = await response.json()

    return results.results
}

async function triggerAlert(meta) {
    let key = "no_events"
    await triggerWebHook(meta,'trigger')
    await meta.cache.set("active_alert", key)
    return key
}

async function resolveAlert(meta) {
    await triggerWebHook(meta,'resolved')
    await meta.cache.set("active_alert", null)
}

async function triggerWebHook(meta, status){
    var webHookUrl = meta.config.webHookUrlTriggered
    if(status === 'resolved'){
        webHookUrl = meta.config.webHookUrlResolved
    }

    const response = await fetch(webHookUrl)
    
    if (!response.ok) {
        throw Error(`Error from WebHook: status=${response.status} response=${await response.text()}`)
    }

    return response
}

function eventsApiUrl(instanceURL, timeRange) {
    let time_from = new Date(Date.now() - (parseInt(timeRange)*60*1000)).toISOString()
    let url = new URL(`${instanceURL}/api/event?after=${time_from}`)
    url.searchParams.set('refresh', 'true')
    return url.href
}