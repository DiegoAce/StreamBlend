'use strict';

const LOG = require('./log');
const Constants = require('./constants');
const Misc = require('./misc');
let {agents} = require('./agents');

const CollapsedName = 'Collapsed';
let contentElement;
let sideBarElement;
let channelsElement = document.createElement('div');

async function updateFollowElements()
{
    let collapsed = Boolean(await Misc.getStorage(CollapsedName));
    let follows = [];
    for (let a of agents)
    {
        if (a.follows)
        {
            for (let f of a.follows)
                f.agentImage = await a.getImage(true);
            follows = [...follows, ...a.follows];
        }
    }
    follows.sort((f1, f2)=>{ return f1.online && f2.online ? f2.viewerCount - f1.viewerCount : (f2.online ? 1 : -1); });
    while (channelsElement.firstChild)
        channelsElement.firstChild.remove();
    for (let f of follows)
    {
        let element = Misc.createDOMElement('a', {className: 'streamBlendChannel', href: f.link});
        let avatarElement = Misc.createDOMElement('img', {className: 'streamBlendAvatar' + (f.online ? '' : ' streamBlendOffline'), src: f.avatarUrl, alt: ''});
        avatarElement.onerror = (element)=>{ avatarElement.onerror = null; avatarElement.src = 'images/defaultUser.svg'; };
        element.appendChild(avatarElement);
        if (!collapsed)
        {
            element.appendChild(Misc.createDOMElement('div', {className: 'streamBlendChannelName', textContent: f.userName}));
            element.appendChild(Misc.createDOMElement('div', {className: 'streamBlendActivityName', textContent: (f.online ? f.activityName : '')}));
            element.appendChild(Misc.createDOMElement('div', {className: 'streamBlendViewerCount', textContent: (f.online ? Misc.abbreviateNumber(f.viewerCount) : 'Offline')}));
            element.appendChild(Misc.createDOMElement('img', {className: 'streamBlendAgentImage', src: chrome.runtime.getURL('images/' + f.agentImage), alt: ''}));
        }
        channelsElement.appendChild(element);
    }
    if (!channelsElement.firstChild)
    {
        let element = document.createElement('div');
        element.className = 'streamBlendEmptyText';
        element.appendChild(document.createTextNode('No channels to show.'));
        element.appendChild(document.createElement('br'));
        element.appendChild(document.createTextNode('Click on the StreamBlend browser toolbar icon to connect your accounts.'));
        channelsElement.appendChild(element);
    }
}

async function setSideBar()
{
    if (sideBarElement)
        sideBarElement.remove();
    sideBarElement = null;
    contentElement.style = '';
    if (await Misc.getStorage(Constants.HideMixerSideBarName))
        return;
    sideBarElement = document.createElement('div');
    let collapsed = await Misc.getStorage(CollapsedName);
    let arrowElement = document.createElement('div');
    arrowElement.onclick = async ()=>
    {
        await Misc.setStorage(CollapsedName, !Boolean(await Misc.getStorage(CollapsedName)));
        await setSideBar();
        await updateFollowElements();
    };
    let arrowImgElement = document.createElement('img');
    arrowImgElement.src = chrome.runtime.getURL('images/collapse.svg');
    if (collapsed)
    {
        contentElement.style = 'margin-left: 50px;';
        sideBarElement.className = 'streamBlendSideBarCollapsed';
        arrowElement.className = 'streamBlendArrowCollapsed';
        arrowImgElement.className = 'streamBlendArrowCollapsedImg';
    }
    else
    {
        contentElement.style = 'margin-left: 225px;';
        sideBarElement.className = 'streamBlendSideBarExpanded';
        let followedElement = document.createElement('div');
        followedElement.className = 'streamBlendFollowed';
        followedElement.textContent = 'FOLLOWED CHANNELS';
        arrowElement.className = 'streamBlendArrowExpanded';
        arrowImgElement.className = 'streamBlendArrowExpandedImg';
        sideBarElement.appendChild(followedElement);
    }
    arrowElement.appendChild(arrowImgElement);
    sideBarElement.appendChild(arrowElement);
    sideBarElement.appendChild(channelsElement);
    contentElement.appendChild(sideBarElement);
}

async function refresh()
{
    if (await Misc.getStorage(Constants.HideMixerSideBarName))
        return;
    for (let a of agents)
        a.sendMsgRefreshFollows();
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse)=>
{
    LOG("mixer content received message:", request.type);
    if (await Misc.getStorage(Constants.HideMixerSideBarName))
        return;
    switch (request.type)
    {
    default:
        for (let a of agents)
        {
            switch (request.type)
            {
            case a.msgFollowsRefreshed:
                a.follows = await a.getFollows();
                await updateFollowElements();
                break;
            default:
                break;
            }
        }
        break;
    }
    sendResponse({});
});

chrome.storage.onChanged.addListener(async (changes, areaName) =>
{
    for (let key in changes)
    {
        switch (key)
        {
        case Constants.HideMixerSideBarName:
            await setSideBar();
            await refresh();
            break;
        default:
            break;
        }
    }
});

chrome.runtime.sendMessage({type: Constants.MixerTabIdMsg});

let fontStyle = document.createElement('style');
fontStyle.appendChild(document.createTextNode('                                     \
@font-face {\
  font-family: texgyreheros;\
  src: url(' + chrome.runtime.getURL('fonts/texgyreheros-regular.woff') + ');\
}\
\
@font-face {\
  font-family: texgyreheros;\
  src: url(' + chrome.runtime.getURL('fonts/texgyreheros-bold.woff') + ');\
  font-weight: bold;\
}\
'));
document.head.appendChild(fontStyle);

let observerInterval = setInterval(async ()=>
{
    contentElement = document.querySelector('.content');
    if (!contentElement)
        return;
    await setSideBar();
    clearInterval(observerInterval);
    await refresh();
    setInterval(refresh, 30 * 1000);
}, 1000);
