'use strict';

const LOG = require('./log');
const Constants = require('./constants');
const Misc = require('./misc');
let {agents, twitch} = require('./agents');

let currentElements = [];
let removedElements = [];

function updateFollowElements()
{
    LOG("updateFollowElements");
    removedElements = currentElements;
    for (let e of currentElements)
        e.remove();
    currentElements = [];
    
    let sideNavSectionRef = document.querySelector('.side-nav-section');
    if (!sideNavSectionRef)
        return LOG('no sideNavSectionRef');
    let sideNavHeaderRef = sideNavSectionRef.querySelector('.side-nav-header');
    if (!sideNavHeaderRef)
        return LOG('no sideNavHeaderRef');
    let sideNavType = sideNavHeaderRef.getAttribute('data-a-target');
    let sideNavExpanded;
    if (sideNavType.indexOf('expand') !== -1)
        sideNavExpanded = true;
    else if (sideNavType.indexOf('collapse') !== -1)
    {
        sideNavExpanded = false;
        if (!twitch.follows || !twitch.follows.length)
            return LOG('side nav collapsed but twitch not linked');
    }
    else
        return LOG('no sideNavType.', sideNavType);
    if (sideNavHeaderRef.innerHTML.indexOf('follow') === -1 && sideNavHeaderRef.innerHTML.indexOf('Follow') === -1)
        return LOG('no Followed Channels');
    let twRelativeRef = sideNavSectionRef.querySelector('.tw-relative');
    if (!twRelativeRef)
        return LOG('no twRelativeRef');
    let parentNodeReference = twRelativeRef;
    let showMoreButtonExists = sideNavSectionRef.innerHTML.search('Show More') !== -1;
    let twitchFollowViewers = [];
    let twitchFollowReruns = 0;
    let twitchFollowOfflines = 0;
    for (let node of parentNodeReference.childNodes)
    {
        if (sideNavExpanded)
        {
            if (node.innerHTML.search('rerun') !== -1)
                twitchFollowReruns++;
            else
            {
                let spanRef = node.querySelector('span.tw-c-text-alt');
                if (spanRef.innerHTML === "Offline")
                    twitchFollowOfflines++;
                else
                    twitchFollowViewers.push(Misc.unabbreviateNumber(spanRef.innerHTML));
            }
        }
        else
        {
            let figure = node.querySelector('figure');
            if (!figure)
            {
                LOG('no figure');
                break;
            }
            let name = figure.getAttribute('aria-label');
            for (let f of twitch.follows)
                if (f.userName === name)
                    twitchFollowViewers.push(f.viewerCount);
        }
    }
    twitchFollowViewers.sort((a, b)=>{ return b-a });
    
    for (let a of agents)
    {
        if (a === twitch || !a.follows)
            continue;
        for (let f of a.follows)
        {
            let element = document.createElement('div');
            if (sideNavExpanded)
            {
                if (f.online)
                    element.innerHTML = '<div class="tw-transition tw-transition--duration-medium tw-transition--enter-done tw-transition__scale-over tw-transition__scale-over--enter-done" style="transition-property: transform, opacity; transition-timing-function: ease;"><div><div class="side-nav-card tw-align-items-center tw-flex tw-relative"><a class="side-nav-card__link tw-align-items-center tw-flex tw-flex-nowrap tw-full-width tw-interactive tw-link tw-link--hover-underline-none tw-pd-x-1 tw-pd-y-05" data-a-target="followed-channel" href="' + f.link + '"><div class="side-nav-card__avatar tw-align-items-center tw-flex-shrink-0"><figure aria-label="' + f.userName + '" class="tw-avatar tw-avatar--size-30"><img class="tw-block tw-border-radius-rounded tw-image tw-image-avatar" alt="' + f.userName + '" src="' + f.avatarUrl + '"></figure></div><div class="tw-ellipsis tw-flex tw-full-width tw-justify-content-between"><div data-a-target="side-nav-card-metadata" class="tw-ellipsis tw-full-width tw-mg-l-1"><div class="side-nav-card__title tw-align-items-center tw-flex"><p class="tw-c-text-alt tw-ellipsis tw-ellipsis tw-flex-grow-1 tw-font-size-5 tw-line-height-heading tw-semibold" data-a-target="side-nav-title" title="' + f.userName + '">' + f.userName + '</p></div><div data-a-target="side-nav-game-title" class="side-nav-card__metadata tw-pd-r-05"><p class="tw-c-text-alt-2 tw-ellipsis tw-font-size-6 tw-line-height-heading" title="' + f.activityName + '">' + f.activityName + '</p></div></div><div data-a-target="side-nav-live-status" class="side-nav-card__live-status tw-flex-shrink-0 tw-mg-l-05"><div class="tw-align-items-center tw-flex"><div class="tw-border-radius-rounded tw-channel-status-indicator tw-channel-status-indicator--live tw-channel-status-indicator--small tw-inline-block tw-relative"></div><div class="tw-mg-l-05"><span class="tw-c-text-alt tw-font-size-6">' + Misc.abbreviateNumber(f.viewerCount) + '</span></div></div></div></div></a></div></div></div>';
                else
                    element.innerHTML = '<div class="tw-transition tw-transition--duration-medium tw-transition--enter-done tw-transition__scale-over tw-transition__scale-over--enter-done" style="transition-property: transform, opacity; transition-timing-function: ease;"><div><div class="side-nav-card tw-align-items-center tw-flex tw-relative"><a class="side-nav-card__link tw-align-items-center tw-flex tw-flex-nowrap tw-full-width tw-interactive tw-link tw-link--hover-underline-none tw-pd-x-1 tw-pd-y-05" data-a-target="followed-channel" href="' + f.link + '"><div class="side-nav-card__avatar side-nav-card__avatar--offline tw-align-items-center tw-flex-shrink-0"><figure aria-label="' + f.userName + '" class="tw-avatar tw-avatar--size-30"><img class="tw-block tw-border-radius-rounded tw-image tw-image-avatar" alt="' + f.userName + '" src="' + f.avatarUrl + '"></figure></div><div class="tw-ellipsis tw-flex tw-full-width tw-justify-content-between"><div data-a-target="side-nav-card-metadata" class="tw-ellipsis tw-full-width tw-mg-l-1"><div class="side-nav-card__title tw-align-items-center tw-flex"><p class="tw-c-text-alt tw-ellipsis tw-ellipsis tw-flex-grow-1 tw-font-size-5 tw-line-height-heading tw-semibold" data-a-target="side-nav-title" title="' + f.userName + '">' + f.userName + '</p></div><div data-a-target="side-nav-game-title" class="side-nav-card__metadata tw-pd-r-05"><p class="tw-c-text-alt-2 tw-ellipsis tw-font-size-6 tw-line-height-heading" title="10 new videos"></p></div></div><div data-a-target="side-nav-live-status" class="side-nav-card__live-status tw-flex-shrink-0 tw-mg-l-05"><span class="tw-c-text-alt tw-font-size-6">Offline</span></div></div></a></div></div></div>';
            }
            else
            {
                if (f.online)
                    element.innerHTML = '<div style="transition-property: transform, opacity; transition-timing-function: ease;" class="tw-transition tw-transition--duration-medium tw-transition--enter-done tw-transition__scale-over tw-transition__scale-over--enter-done"><div data-test-selector="side-nav-card-collapsed"><a class="side-nav-card tw-align-items-center tw-flex tw-flex-nowrap tw-interactive tw-link tw-pd-x-1 tw-pd-y-05" href="' + f.link + '"><div class="side-nav-card__avatar tw-flex-shrink-0"><figure aria-label="' + f.userName + '" class="tw-avatar tw-avatar--size-30"><img class="tw-block tw-border-radius-rounded tw-image tw-image-avatar" alt="' + f.userName + '" src="' + f.avatarUrl + '"></figure></div></a></div></div>';
                else
                    element.innerHTML = '<div style="transition-property: transform, opacity; transition-timing-function: ease;" class="tw-transition tw-transition--duration-medium tw-transition--enter-done tw-transition__scale-over tw-transition__scale-over--enter-done"><div data-test-selector="side-nav-card-collapsed"><a class="side-nav-card tw-align-items-center tw-flex tw-flex-nowrap tw-interactive tw-link tw-pd-x-1 tw-pd-y-05" href="' + f.link + '"><div class="side-nav-card__avatar side-nav-card__avatar--offline tw-flex-shrink-0"><figure aria-label="' + f.userName + '" class="tw-avatar tw-avatar--size-30"><img class="tw-block tw-border-radius-rounded tw-image tw-image-avatar" alt="' + f.userName + '" src="' + f.avatarUrl + '"></figure></div></a></div></div>';
            }
            currentElements.push(element);
            
            if (f.online)
            {
                let index = twitchFollowViewers.findIndex(n => n < f.viewerCount);
                if (index === -1)
                {
                    if (twitchFollowReruns > 0 || twitchFollowOfflines > 0 || !showMoreButtonExists)
                    {
                        index = twitchFollowViewers.length;
                        twitchFollowViewers.splice(index, 0, f.viewerCount);
                        Misc.insertChildNodeAtIndex(element, parentNodeReference, index);
                    }
                }
                else
                {
                    twitchFollowViewers.splice(index, 0, f.viewerCount);
                    Misc.insertChildNodeAtIndex(element, parentNodeReference, index);
                }
            }
            else
            {
                if (!showMoreButtonExists && sideNavExpanded)
                    parentNodeReference.appendChild(element);
            }
        }
    }
}

function refresh()
{
    for (let a of agents)
        a.sendMsgRefreshFollows();
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse)=>
{
    LOG("twitch content received message:", request.type);
    switch (request.type)
    {
    default:
        for (let a of agents)
        {
            switch (request.type)
            {
            case a.msgFollowsRefreshed:
                a.follows = await a.getFollows();
                updateFollowElements();
                break;
            default:
                break;
            }
        }
        break;
    }
    sendResponse({});
});

chrome.runtime.sendMessage({type: Constants.TwitchTabIdMsg});

let mutationObserver = new MutationObserver((mutations) =>
{
    if (document.readyState !== 'loading')
    {
        LOG("side nav mutated");
        let update = false;
        for (let m of mutations)
        {
            const elementsContainAllNodes = (elements, nodes) =>
            {
                for (let node of nodes)
                    if (!elements.includes(node))
                        return false;
                return true;
            }
            if (!elementsContainAllNodes(removedElements, m.removedNodes) || !elementsContainAllNodes(currentElements, m.addedNodes))
                update = true;
        }
        if (update)
            updateFollowElements();
    }
});

let observerInterval = setInterval(()=>
{
    let sideNav = document.querySelector('.side-nav');
    if (!sideNav)
        return;
    mutationObserver.observe(sideNav, {childList: true, subtree: true});
    LOG('observing side nav');
    clearInterval(observerInterval);
    refresh();
    setInterval(refresh, 30 * 1000);
}, 1000);

