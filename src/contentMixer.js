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
        let element = document.createElement('div');
        if (collapsed)
        {
            element.innerHTML = '<a class="streamBlendChannel" href="'+f.link+'"> \
                                    <img class="streamBlendAvatar' + (f.online ? '' : ' streamBlendOffline') + '" src="' + f.avatarUrl + '" alt=""> \
                                </a>';
        }
        else
        {
            element.innerHTML = '<a class="streamBlendChannel" href="'+f.link+'"> \
                                    <img class="streamBlendAvatar' + (f.online ? '' : ' streamBlendOffline') + '" src="' + f.avatarUrl + '" alt=""> \
                                    <div class="streamBlendChannelName">' + f.userName + '</div> \
                                    <div class="streamBlendActivityName">' + (f.online ? f.activityName : '') + '</div> \
                                    <div class="streamBlendViewerCount">' + (f.online ? Misc.abbreviateNumber(f.viewerCount) : 'Offline') + '</div> \
                                    <img class="streamBlendAgentImage" src="' + chrome.runtime.getURL('images/' + f.agentImage) + '" alt=""> \
                                </a>';
        }
        let avatarElement = element.getElementsByClassName('streamBlendChannel')[0].getElementsByClassName('streamBlendAvatar')[0];
        avatarElement.onerror = (element)=>{ avatarElement.onerror = null; avatarElement.src = 'images/defaultUser.svg'; };
        channelsElement.appendChild(element);
    }
    if (!channelsElement.firstChild)
    {
        
        let element = document.createElement('div');
        element.classList = 'streamBlendEmptyText';
        element.innerHTML = 'No channels to show.<br />Click on the StreamBlend browser toolbar icon to connect your accounts.';
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
        sideBarElement.classList = 'streamBlendSideBarCollapsed';
        arrowElement.classList = 'streamBlendArrowCollapsed';
        arrowImgElement.classList = 'streamBlendArrowCollapsedImg';
    }
    else
    {
        contentElement.style = 'margin-left: 225px;';
        sideBarElement.classList = 'streamBlendSideBarExpanded';
        let followedElement = document.createElement('div');
        followedElement.classList = 'streamBlendFollowed';
        followedElement.textContent = 'FOLLOWED CHANNELS';
        arrowElement.classList = 'streamBlendArrowExpanded';
        arrowImgElement.classList = 'streamBlendArrowExpandedImg';
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
