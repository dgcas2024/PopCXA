import { useEffect, useRef, useState } from "react";
/*import { v4 as uuidv4 } from 'uuid';*/
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
    ConsoleLogAppender,
    AgentSettings,
    ApiUriConstants,
    HttpUtilService,
    HttpClient,
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    UnavailableCode,
    AgentStateEvent,
    SortingType,
    CallContactEvent,
    CXoneCase,
    CXoneMessageArray,
    AgentLegEvent,
    AgentSessionStatus,
    AgentSessionResponse,
    UserInfo
} from "@nice-devone/common-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
    //CXoneUser
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    CXoneDigitalContact,
    DigitalService,
} from "@nice-devone/digital-sdk";
import { CXoneVoiceClient } from "@nice-devone/voice-sdk";
import { CXoneClient } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';
import SessionConnectionSelect from "./components/SessionConnectionSelect";
import ChatContainer, { ChatMessage } from './components/ChatContainer';

import { LoggerConfig, LogLevel, Logger } from "@nice-devone/core-sdk";
Logger.config = new LoggerConfig();
Logger.config.setLevel(LogLevel.ERROR);
Logger.config.addAppender(new ConsoleLogAppender())

const authSetting: AuthSettings = {
    cxoneHostname: process.env.REACT_APP__CXONE_HOST_NAME || '',
    clientId: process.env.REACT_APP__CXONE_CLIENT_ID || '',
    redirectUri: process.env.REACT_APP__CXONE_AUTH_REDIRECT_URL || '',
};

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const App = () => {
    const cxoneAuth = CXoneAuth.instance;
    const digitalService = new DigitalService();
    const cxoneDigitalContact = new CXoneDigitalContact();
    const utilService = new HttpUtilService();

    const [unavailableCodeArray, setUnavailableCodeArray] = useState<Array<UnavailableCode>>([]);
    const [dialNumber, setDialNumber] = useState('');

    const [webRTC, setWebRTC] = useState(false);
    const [authToken, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);
    const [agentSession, setAgentSession] = useState<AgentSessionResponse | null>(null);
    const [authState, setAuthState] = useState("");
    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<{ contactID: string, status: string, agentMuted: boolean }>>([]);
    const [caseDataArray, setCaseDataArray] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);
    const [currentVoiceContactData, setCurrentVoiceContactData] = useState<{ contactID: string, status: string, agentMuted: boolean } | null>(null);
    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);
    const [agentLegId, setAgentLegId] = useState<string | null>(null);

    const authTokenRef = useRef(authToken);
    const agentStatusRef = useRef(agentStatus);
    const agentSessionRef = useRef(agentSession);
    const authStateRef = useRef(authState);
    const caseDataArrayRef = useRef(caseDataArray);
    const voiceContactDataArrayRef = useRef(voiceContactDataArray);
    const callContactDataArrayRef = useRef(callContactDataArray);
    const currentUserInfoRef = useRef(currentUserInfo);
    const currentVoiceContactDataRef = useRef(currentVoiceContactData);
    const currentCallContactDataRef = useRef(currentCallContactData);
    const currentCaseDataRef = useRef(currentCaseData);

    useEffect(() => {
        authTokenRef.current = authToken;
        agentStatusRef.current = agentStatus;
        currentUserInfoRef.current = currentUserInfo;
        currentCallContactDataRef.current = currentCallContactData;
        currentVoiceContactDataRef.current = currentVoiceContactData;
        currentCaseDataRef.current = currentCaseData;
        agentSessionRef.current = agentSession;
        authStateRef.current = authState;
        caseDataArrayRef.current = caseDataArray;
        voiceContactDataArrayRef.current = voiceContactDataArray;
        callContactDataArrayRef.current = callContactDataArray;
    }, [currentCallContactData, currentUserInfo, currentVoiceContactData, currentCaseData, agentSession, authState, caseDataArray, voiceContactDataArray, callContactDataArray, authToken, agentStatus]);

    const [messageDataArray, setMessageDataArray] = useState<Array<ChatMessage>>([]);

    const appDivRef = useRef<HTMLDivElement>(null);
    const caseListDivRef = useRef<HTMLDivElement>(null);
    const audioWebRTCRef = useRef<HTMLAudioElement>(null);

    const refreshCaseArray = async function (cuser: any) {
        const _caseDataArray = await digitalService.getDigitalContactSearchResult({
            sortingType: SortingType.DESCENDING,
            sorting: 'createdAt',
            inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
            status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
        }, true, true);
        console.log('Case data Array', _caseDataArray);
        for (var i = 0; i < _caseDataArray.data.length; i++) {
            if (!_caseDataArray.data[i].authorEndUserIdentity) {
                const baseUrl = cxoneAuth.getCXoneConfig().dfoApiBaseUri;
                const authToken = cxoneAuth.getAuthToken().accessToken;
                const url = baseUrl + ApiUriConstants.DIGITAL_CONTACT_DETAILS.replace('{contactId}', _caseDataArray.data[i].id);
                const reqInit = utilService.initHeader(authToken);
                const res: any = await HttpClient.get(url, reqInit);
                try {
                    _caseDataArray.data[i].authorEndUserIdentity = res.body.customer.identities[0];
                    _caseDataArray.data[i].authorEndUserIdentity.fullName = (_caseDataArray.data[i].authorEndUserIdentity.firstName ?? '') + ' ' + (_caseDataArray.data[i].authorEndUserIdentity.lastName ?? '')
                }
                catch {
                    //res.body.customer is null
                }
            }
        }
        setCaseDataArray((_caseDataArray.data as Array<any>));
    }

    const setupEvent = function () {
        // ACD SDK consumption
        CXoneAcdClient.instance.initAcdEngagement();
        CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(agentState.agentStateData.StartTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //agentState.agentStateData.StartTime = new Date(originStartTime + delta);
            setAgentStatus(agentState);
            console.log('agentState', agentState);
        });
        CXoneAcdClient.instance.session.agentLegEvent.subscribe((data: AgentLegEvent) => {
            console.log('agentLegEvent', data);
            if (data.status?.toLowerCase() === "dialing") {
                setTimeout(() => {
                    if (callContactDataArrayRef.current.filter(x => x.status?.toLowerCase() === "incoming").length === 0) {
                        CXoneVoiceClient.instance.connectAgentLeg(data.agentLegId);
                    }
                }, 500);
                setAgentLegId(data.agentLegId);
                console.log('agentLegEvent Dialing...', data.agentLegId)
            }
            if (data.status === "Disconnected") {
                setAgentLegId(null);
                console.log('agentLegEvent Disconnected', data.agentLegId)
            }
        });
        CXoneAcdClient.instance.session.onAgentSessionChange?.subscribe(async (agentSessionChange) => {
            setAgentSession(agentSessionChange);
            console.log('onAgentSessionChange', agentSessionChange)
            switch (agentSessionChange.status) {
                case AgentSessionStatus.JOIN_SESSION_SUCCESS:
                case AgentSessionStatus.SESSION_START: {
                    console.log("Session started successfully.....");
                    break;
                }
                case AgentSessionStatus.SESSION_END: {
                    console.log("Session ended successfully.....");
                    break;
                }
                case AgentSessionStatus.JOIN_SESSION_FAILURE:
                    console.log("Session join failed.....");
                    break;
            }
        });
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: { contactID: string, status: string, agentMuted: boolean }) => {
            voiceContactEvent = {
                contactID: voiceContactEvent.contactID,
                status: voiceContactEvent.status,
                agentMuted: voiceContactEvent.agentMuted,
            }
            console.log("voiceContactUpdateEvent", voiceContactEvent);

            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(voiceContactEvent.startTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //voiceContactEvent.startTime = new Date(originStartTime + delta);

            if (currentVoiceContactDataRef.current?.contactID === voiceContactEvent.contactID) {
                setCurrentVoiceContactData(voiceContactEvent);
                if (voiceContactEvent.status === 'Disconnected') {
                    setCurrentVoiceContactData(null);
                }
            }

            setVoiceContactDataArray(arr => arr.filter(item => item.contactID !== voiceContactEvent.contactID));
            if (voiceContactEvent.status !== 'Disconnected') {
                setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
            }
        });
        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            console.log("callContactEvent", callContactEvent);

            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(callContactEvent.startTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //callContactEvent.startTime = new Date(originStartTime + delta);

            if (currentCallContactDataRef.current?.contactId === callContactEvent.contactId) {
                setCurrentCallContactData(callContactEvent);
                if (callContactEvent.status === 'Disconnected') {
                    setCurrentCallContactData(null);
                }
            }

            setCallContactDataArray(arr => arr.filter(item => item.contactId !== callContactEvent.contactId));
            if (callContactEvent.status !== 'Disconnected') {
                setCallContactDataArray(arr => [...arr, callContactEvent]);
            }
        });

        // Digital SDK consumption
        CXoneDigitalClient.instance.initDigitalEngagement();
        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
            console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
        });
        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
            console.log("onDigitalContactEvent", digitalContactEvent);
            refreshCaseArray(currentUserInfoRef.current);
            if (currentCaseDataRef.current?.id === digitalContactEvent.caseId) {
                if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                    setCurrentCaseData(digitalContactEvent.case);
                    if (digitalContactEvent.case.status === 'closed') {
                        selectCaseItem(null);
                    }
                } else {
                    if (digitalContactEvent.isCaseAssigned) {
                        setMessageDataArray([]);
                        handleSetMessageData(digitalContactEvent.messages);
                    } else {
                        selectCaseItem(null);
                    }
                }
            }
        });
    }

    const setup = async function () {
        const _unavailableCodeArray = await CXoneAcdClient.instance.session.agentStateService.getTeamUnavailableCodes();
        if (Array.isArray(_unavailableCodeArray)) {
            _unavailableCodeArray.push({
                isActive: true,
                isAcw: false,
                reason: ''
            } as UnavailableCode);
            setUnavailableCodeArray(_unavailableCodeArray);
        }
        const cuser = await digitalService.getDigitalUserDetails() as any;
        setCurrentUserInfo(cuser);
        console.log(cuser);
        await refreshCaseArray(cuser);
    }

    useEffect(() => {
        if (!webRTC && (agentSession?.status === AgentSessionStatus.SESSION_START || agentSession?.status === AgentSessionStatus.JOIN_SESSION_SUCCESS) && currentUserInfo) {
            const exec = async function () {
                try {
                    if (audioWebRTCRef.current) {
                        const agentSettings = (await CXoneClient.instance.agentSetting.getAgentSettings()) as AgentSettings;
                        const getUserInfo = (await CXoneClient.instance.cxoneUser.getUserDetails()) as UserInfo;
                        if (agentSettings && getUserInfo.icAgentId) {
                            const settings = {
                                agentId: getUserInfo.icAgentId,
                                agentSettings: agentSettings,
                                userInfo: getUserInfo,
                            };
                            CXoneVoiceClient.instance.connectServer(settings.agentId, settings.agentSettings, audioWebRTCRef.current, "Poptech CXAgent");
                            setWebRTC(true);
                            console.log("Connected to WebRTC");
                        }
                    } else {
                        //alert('Connected to WebRTC error: not found audio tag');
                        console.error('Connected to WebRTC error: not found audio tag');
                    }
                } catch(e) {
                    console.error('Connected to WebRTC error', e)
                }
            }
            exec();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentSession]);

    useEffect(() => {
        console.log('useEffect[caseDataArray]...');
        if (caseListDivRef?.current) {
            caseListDivRef.current.scrollTop = 0;
        }
    }, [caseDataArray]);

    useEffect(() => {
        console.log('useEffect...');
        cxoneAuth.onAuthStatusChange.subscribe((data) => {
            switch (data.status) {
                case AuthStatus.AUTHENTICATING:
                    setAuthState("AUTHENTICATING");
                    setCurrentUserInfo(null);
                    break;
                case AuthStatus.AUTHENTICATED:
                    setAuthState("AUTHENTICATED");
                    if (window.location.pathname !== '/') {
                        window.location.href = '/';
                    }
                    setAuthToken((data.response as AuthToken).accessToken);

                    setupEvent();
                    setup();
                    try {
                        CXoneAcdClient.instance.session.joinSession().catch(() => { });
                    } catch { }
                    break;
                case AuthStatus.NOT_AUTHENTICATED:
                    setAuthState("NOT_AUTHENTICATED");
                    setCurrentUserInfo(null);
                    break;
                case AuthStatus.AUTHENTICATION_FAILED:
                    setAuthState("AUTHENTICATION_FAILED");
                    setCurrentUserInfo(null);
                    break;
                default:
                    setCurrentUserInfo(null);
                    setAuthState("");
                    break;
            }
        });
        cxoneAuth.restoreData();

        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code") || "";
        if (code) {
            //cxoneAuth.init(authSetting);
            //const authObject: AuthWithCodeReq = {
            //    clientId: authSetting.clientId,
            //    code: code,
            //};
            //cxoneAuth.getAccessTokenByCode(authObject);
            //return;
            const message = { messageType: "Authenticated", code: code };
            window.opener?.postMessage({ message }, "*");
            return;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sidebarCollapse = !localStorage.getItem('sidebar-collapse-open') || localStorage.getItem('sidebar-collapse-open') === '1' ? 'sidebar-collapse-open' : '';

    function closeSidebar() {
        appDivRef.current?.classList?.remove('sidebar-collapse-open');
        localStorage.setItem('sidebar-collapse-open', '0');
    }

    function openSidebar() {
        appDivRef.current?.classList?.add('sidebar-collapse-open');
        localStorage.setItem('sidebar-collapse-open', '1');
    }

    function handleSetMessageData(messages: CXoneMessageArray) {
        messages.forEach(m => {
            if (m.direction === 'inbound') {
                const messageData: ChatMessage = {
                    chater: {
                        name: m.authorEndUserIdentity.fullName,
                        avatar: m.authorEndUserIdentity.image,
                        time: new Date(m.createdAt).getTime()
                    },
                    content: m.messageContent.text,
                    type: 'received',
                    mediaType: null,
                    mediaUrl: null
                }
                if (m.attachments?.length > 0) {
                    messageData.mediaType = 'html';
                    messageData.mediaUrl = m.messageContent.text ? `<div>${m.messageContent.text}</div>` : '';
                    m.attachments.forEach(x => {
                        messageData.mediaUrl += `<a href="${x.url}">${x.fileName || x.friendlyName}</a>`
                    });
                }
                setMessageDataArray(arr => [...arr, messageData]);
            } else {
                let avatar = defaultUserAvatar;
                if (m.authorUser?.id === currentUserInfoRef.current?.user.id) {
                    avatar = currentUserInfoRef.current.user.publicImageUrl;
                }
                const messageData: ChatMessage = {
                    chater: {
                        name: `${m.authorUser?.firstName ?? 'SYSTEM'} ${m.authorUser?.surname ?? ''}`,
                        avatar: avatar,
                        time: new Date(m.createdAt).getTime()
                    },
                    content: m.messageContent.text,
                    type: 'sent',
                    mediaType: null,
                    mediaUrl: null
                }
                if (m.attachments?.length > 0) {
                    messageData.mediaType = 'html';
                    messageData.mediaUrl = m.messageContent.text ? `<div>${m.messageContent.text}</div>` : '';
                    m.attachments.forEach(x => {
                        messageData.mediaUrl += `<a href="${x.url}">${x.fileName || x.friendlyName}</a>`
                    });
                }
                setMessageDataArray(arr => [...arr, messageData]);
            }
        });
    }

    async function updateAgentState(event: any) {
        if (event.target.value === '0000') {
            await CXoneAcdClient.instance.session.endSession({
                endContacts: true,
                forceLogoff: true,
                ignorePersonalQueue: true
            });
            return;
        }
        const state = JSON.parse(event.target.value) as { state: string, reason: string };
        console.log('updateAgentState', state);
        await CXoneAcdClient.instance.session.agentStateService.setAgentState({
            state: state.state,
            reason: state.reason,
            isACW: false
        });
    }

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        setCurrentCaseData(caseData);
        setMessageDataArray([]);
        if (caseData?.id != null) {
            const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
            handleSetMessageData(conversationHistory.messages);
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        setCurrentCallContactData(callContactData);
        setCurrentVoiceContactData(voiceContactDataArrayRef.current.filter(item => item.contactID === callContactData?.contactId)[0]);
        setMessageDataArray([]);
    }

    function handleAuthButtonClick() {
        cxoneAuth.init(authSetting);
        cxoneAuth.getAuthorizeUrl('page', 'S256').then((authUrl: string) => {
            //window.location.href = authUrl;
            const popupOptions = `width=500,height=800,scrollbars=yes,toolbar=no,left=${window.screenX + 300},top=${window.screenY + 100}`;
            const popupWindow = window.open(authUrl, "authWindow", popupOptions);
            window.addEventListener(
                "message",
                (event) => {
                    const message = event.data.message;
                    if (message && message["messageType"] === "Authenticated") {
                        const authObject: AuthWithCodeReq = {
                            clientId: authSetting.clientId,
                            code: message.code,
                        };
                        cxoneAuth.getAccessTokenByCode(authObject);
                        popupWindow?.close();
                    }
                },
                false
            );
        });
    }

    const handleDial = async () => {
        if (!dialNumber) {
            alert('please enter dial number');
            return;
        }
        const skills = await CXoneAcdClient.instance.getAgentSkills(currentUserInfoRef.current.user.agentId);
        console.log(skills)
        const dialInfo = {
            skillId: skills[0].skillId,
            phoneNumber: dialNumber,
        };
        await CXoneAcdClient.instance.contactManager.voiceService.dialPhone(dialInfo);
    };

    //const handleAgentLeg = async () => {
    //    await CXoneAcdClient.instance.agentLegService.dialAgentLeg();
    //};

    if (authState !== "AUTHENTICATED") {
        if (authState === "AUTHENTICATING") {
            return (
                <div className="app">
                    <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                        <h4>AUTHENTICATING</h4>
                    </div>
                </div>
            )
        }
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
                    <h4>{authState}</h4>
                    <div style={{ padding: '5px' }}></div>
                    <button onClick={handleAuthButtonClick} style={{ padding: '5px' }}>Get auth</button>
                </div>
            </div>
        )
    }
    if (agentSession?.status !== AgentSessionStatus.SESSION_START && agentSession?.status !== AgentSessionStatus.JOIN_SESSION_SUCCESS) {
        return (
            <div className="app" style={{ display: 'block', height: 'auto' }}>
                <SessionConnectionSelect setup={setup}></SessionConnectionSelect>
            </div>
        )
    }

    const otherStates: Array<{ state: string, reason: string }> = [];
    const currentState = { state: agentStatus?.currentState?.state ?? '', reason: agentStatus?.currentState?.reason ?? '' };
    if ([{ state: 'available', reason: '' }, ...unavailableCodeArray.filter(item => item.isActive && !item.isAcw).map(item => {
        return { state: 'unavailable', reason: item.reason };
    })].map(item => JSON.stringify(item)).filter(item => item === JSON.stringify(currentState)).length === 0) {
        otherStates.push(currentState);
    }

    return (
        <div ref={appDivRef} className={`app ${sidebarCollapse}`}>
            <div ref={caseListDivRef} className="case-list sidebar-collapse">
                <span id="sidebar-collapse-close" className="sidebar-collapse-btn" onClick={closeSidebar}><i className="fas fa-times" style={{ fontSize: '16px', color: 'rgb(102, 102, 102)'}}></i></span>
                <span id="sidebar-collapse-open" className="sidebar-collapse-btn" onClick={openSidebar}><i className="fas fa-bars" style={{ fontSize: '16px', color: 'rgb(102, 102, 102)' }}></i></span>
                <div className="agent-profile">
                    <div className="profile-info">
                        <img src={currentUserInfo?.user?.publicImageUrl ?? defaultUserAvatar} alt="Agent" className="avatar" />
                        <div>
                            <div className="profile-info-name">{currentUserInfo?.user?.fullName ?? 'N/A'}</div>
                            <div style={{ fontSize: '0.8em', color: '#eee' }} data-starttime={agentStatus?.agentStateData?.StartTime}>00:00:00</div>
                        </div>
                    </div>
                    {/*<div style={{ display: 'flex', gap: '5px' }}>*/}
                    {/*    <div style={{*/}
                    {/*        display: 'flex',*/}
                    {/*        border: '1px solid #ccc',*/}
                    {/*        borderRadius: '5px',*/}
                    {/*        overflow: 'hidden',*/}
                    {/*        width: '100%',*/}
                    {/*        marginTop: '5px'*/}
                    {/*    }}>*/}
                    {/*        <button*/}
                    {/*            onClick={handleAgentLeg}*/}
                    {/*            style={{*/}
                    {/*                padding: '6px 12px',*/}
                    {/*                backgroundColor: '#4CAF50',*/}
                    {/*                color: 'white',*/}
                    {/*                border: 'none',*/}
                    {/*                borderLeft: '1px solid rgba(255,255,255,0.2)',*/}
                    {/*                cursor: 'pointer',*/}
                    {/*                fontSize: '14px',*/}
                    {/*                display: 'flex',*/}
                    {/*                alignItems: 'center',*/}
                    {/*                gap: '5px',*/}
                    {/*                width: '100%',*/}
                    {/*                justifyContent: 'center'*/}
                    {/*            }}*/}
                    {/*        >*/}
                    {/*            Connect AgentLeg*/}
                    {/*        </button>*/}
                    {/*    </div>*/}
                    {/*</div>*/}
                    <div className="agent-status">
                        <select className="status-selector" onChange={updateAgentState} value={JSON.stringify(currentState)} style={{
                            borderRadius: '5px', fontSize: '14px', outline: 'none',
                            padding: '6px 30px 6px 12px',
                            border: '1px solid #ccc',
                            backgroundColor: '#fff',
                            color: '#333',
                            cursor: 'pointer',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 8px center',
                            backgroundSize: '16px'
                        }}>
                            <option value={JSON.stringify({ state: 'available', reason: '' })}>Available</option>
                            {otherStates.map((item, index) => {
                                return (
                                    <React.Fragment key={index}>
                                        <option value={JSON.stringify(item)}>{item.state.charAt(0).toUpperCase() + item.state.slice(1)} {(item.reason ?? '') !== '' ? ` - ${item.reason}` : ''}</option>
                                    </React.Fragment>
                                )
                            })}
                            {unavailableCodeArray.filter(item => item.isActive && !item.isAcw).map((item, index) => {
                                return (
                                    <React.Fragment key={index}>
                                        <option value={JSON.stringify({ state: 'unavailable', reason: item.reason })}>Unavailable{(item.reason ?? '') !== '' ? ` - ${item.reason}` : ''}</option>
                                    </React.Fragment>
                                )
                            })}
                            <option value="0000">Logout</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <div style={{ 
                            display: 'flex',
                            border: '1px solid #ccc',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            width: '100%',
                            marginTop: '5px'
                        }}>
                            <audio hidden={true} ref={audioWebRTCRef} id="audio" controls autoPlay />
                            <input
                                type="text"
                                value={dialNumber}
                                onChange={(e) => setDialNumber(e.target.value)}
                                placeholder="Dial number"
                                style={{
                                    padding: '6px 12px',
                                    border: 'none',
                                    fontSize: '14px',
                                    outline: 'none',
                                    width: '100%'
                                }}
                            />
                            <button
                                onClick={handleDial}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                <i className="fas fa-phone"></i>
                            </button>
                        </div>
                    </div>
                </div>
                {callContactDataArray.map((callContactData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCallContactData != null && currentCallContactData.contactId === callContactData.contactId ? 'active' : '')}`} onClick={() => selectCallContactItem(callContactData)}>
                            <div className="case-preview">
                                <img src={defaultUserAvatar} alt="" className="avatar"></img>
                                <div className="preview-details">
                                    <div>{callContactData.ani}</div>
                                    <div className="preview-message">{callContactData.isInbound ? 'InboundCall' : 'OutboundCall'}: {callContactData.status}</div>
                                    <div className="message-time" data-starttime={callContactData.startTime}>00:00:00</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
                {caseDataArray.map((caseData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCaseData != null && currentCaseData.id === caseData.id ? 'active' : '')}`} onClick={() => selectCaseItem(caseData)}>
                            <div className="case-preview">
                                <img src={caseData.authorEndUserIdentity?.image ?? 'N/A'} alt="" className="avatar"></img>
                                <div className={`preview-details${caseData.status.toLowerCase() === 'new' || caseData.status.toLowerCase() === 'open' ? ' item-new' : ''}`}>
                                    <div>{caseData.authorEndUserIdentity?.fullName ?? 'N/A'}</div>
                                    <div className="message-time time-auto-update-off" data-time={caseData.id}>#{caseData.id}: {`${caseData.channelId}`}</div>
                                    <div className="preview-message">{caseData.preview}</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <ChatContainer
                connectAgentLeg={(agentLegId) => { CXoneVoiceClient.instance.connectAgentLeg(agentLegId); } }
                agentLegId={agentLegId}
                currentUserInfo={currentUserInfo}
                currentCallContactData={currentCallContactData}
                currentVoiceContactData={currentVoiceContactData}
                currentCaseData={currentCaseData}
                messageDataArray={messageDataArray}
            />
        </div>
    );
};
export default App;