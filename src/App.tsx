/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { CXoneAcdClient, CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
    StorageKeys,
    ACDSessionManager,
    DateTimeUtilService,
    LocalStorageHelper
} from "@nice-devone/core-sdk";
import {
    AgentSessionStatus,
    AuthToken,
    EndSessionRequest,
    UnavailableCode,
    AgentStateEvent,
    SortingType,
    UserInfo,
    CallContactEvent,
    CXoneCase,
    CXoneMessageArray
} from "@nice-devone/common-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
    AuthWithTokenReq,
    CXoneUser
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    CXoneDigitalContact,
    DigitalService,
} from "@nice-devone/digital-sdk";
import { CXoneVoiceClient } from "@nice-devone/voice-sdk";
import { CXoneClient, ContactService, VoiceControlService } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';
import Call from "./components/Call";
import SessionConnectionSelect from "./components/SessionConnectionSelect";

let _currentCaseData: any = null;
let _currentCallContactData: CallContactEvent | null = null;
let _currentVoiceContactData: CXoneVoiceContact | null = null;

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

    const [authState, setAuthState] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);

    const [currentUserInfo, setCurrentUserInfo] = useState<any>();

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);
    const [currentVoiceContactData, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);
    
    const [caseDataList, setCaseDataList] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);

    const [unavailableCodeArray, setUnavailableCodeArray] = useState<Array<UnavailableCode>>([]);
    
    const [messageDataList, setMessageDataList] = useState<Array<{ chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null, mediaUrl: string | null }>>([]);

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");

    const appDivRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);
    const caseListDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messageListDivRef?.current) {
            messageListDivRef.current.scrollTop = 9999;
        }
    }, [messageDataList]);

    useEffect(() => {
        if (caseListDivRef?.current) {
            caseListDivRef.current.scrollTop = 0;
        }
    }, [caseDataList]);

    useEffect(() => {
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

                    // ACD SDK consumption
                    const acd = async function () {
                        CXoneAcdClient.instance.initAcdEngagement();
                        if (ACDSessionManager.instance.hasSessionId) {
                            CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
                                const serverTime = DateTimeUtilService.getServerTimestamp();
                                const originStartTime = new Date(agentState.agentStateData.StartTime).getTime();
                                const delta = new Date().getTime() - serverTime;
                                agentState.agentStateData.StartTime = new Date(originStartTime + delta);
                                setAgentStatus(agentState);
                                console.log('agentState', agentState);
                            });

                            CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
                                console.log("voiceContactUpdateEvent", voiceContactEvent);

                                const serverTime = DateTimeUtilService.getServerTimestamp();
                                const originStartTime = new Date(voiceContactEvent.startTime).getTime();
                                const delta = new Date().getTime() - serverTime;
                                voiceContactEvent.startTime = new Date(originStartTime + delta);

                                if (_currentVoiceContactData?.interactionId === voiceContactEvent.interactionId) {
                                    setCurrentVoiceContactData(voiceContactEvent);
                                }

                                setVoiceContactDataArray(voiceContactDataArray.filter(item => item.interactionId !== voiceContactEvent.interactionId));
                                if (voiceContactEvent.status !== 'Disconnected') {
                                    setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
                                } else {
                                    setCurrentVoiceContactData(null);
                                }
                            });

                            ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
                                console.log("callContactEvent", callContactEvent);

                                const serverTime = DateTimeUtilService.getServerTimestamp();
                                const originStartTime = new Date(callContactEvent.startTime).getTime();
                                const delta = new Date().getTime() - serverTime;
                                callContactEvent.startTime = new Date(originStartTime + delta);

                                if (_currentCallContactData?.interactionId === callContactEvent.interactionId) {
                                    setCurrentCallContactData(callContactEvent);
                                }

                                setCallContactDataArray(callContactDataArray.filter(item => item.interactionId !== callContactEvent.interactionId));
                                if (callContactEvent.status !== 'Disconnected') {
                                    setCallContactDataArray(arr => [...arr, callContactEvent]);
                                } else {
                                    setCurrentCallContactData(null);
                                }
                            });

                            const _unavailableCodeArray = await CXoneAcdClient.instance.session.agentStateService.getTeamUnavailableCodes();
                            if (Array.isArray(_unavailableCodeArray)) {
                                _unavailableCodeArray.push({
                                    isActive: true,
                                    isAcw: false,
                                    reason: ''
                                } as UnavailableCode);
                                setUnavailableCodeArray(_unavailableCodeArray);
                            }
                        }
                    }
                    acd();

                    const user = async function () {
                        const me = await digitalService.getDigitalUserDetails() as any;
                        setCurrentUserInfo(me);
                        console.log('Me', me);
                        return me;
                    }
                    const userTask = user();

                    const digital = async function () {
                        const cuser = await userTask;
                        console.log(cuser)
                        const refreshCaseList = async function () {
                            const _caseDataList = await digitalService.getDigitalContactSearchResult({
                                sortingType: SortingType.DESCENDING,
                                sorting: 'createdAt',
                                inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
                                status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
                            }, true, true);
                            console.log('Case data list', _caseDataList);
                            setCaseDataList([]);
                            (_caseDataList.data as Array<any>).reverse().forEach(c => setCaseDataList(arr => [c, ...arr]));
                        }
                        // Digital SDK consumption
                        CXoneDigitalClient.instance.initDigitalEngagement();
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                            console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
                        });
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                            console.log("onDigitalContactEvent", digitalContactEvent);
                            refreshCaseList();
                            if (_currentCaseData != null && _currentCaseData.id === digitalContactEvent.caseId) {
                                if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                                    setCurrentCaseData(digitalContactEvent.case);
                                    if (digitalContactEvent.case.status === 'closed') {
                                        selectCaseItem(null);
                                    }
                                } else {
                                    if (digitalContactEvent.isCaseAssigned) {
                                        setMessageDataList([]);
                                        handleSetMessageData(digitalContactEvent.messages);
                                    } else {
                                        selectCaseItem(null);
                                    }
                                }
                            }
                        });
                        await refreshCaseList();
                    }
                    digital();
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
            cxoneAuth.init(authSetting);
            const authObject: AuthWithCodeReq = {
                clientId: authSetting.clientId,
                code: code,
            };
            cxoneAuth.getAccessTokenByCode(authObject);
            return;
        }
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

    let isRecording = false;
    let mediaRecorder: any = null;
    let audioChunks: any = [];

    function formatDateTime(date: number | Date) {
        let _date = 0;
        if (typeof date != 'number') {
            if (typeof date == typeof '') {
                date = new Date(date);
            }
            _date = date.getTime();
        } else {
            _date = date;
        }
        const __date = new Date(_date);

        const now = new Date();
        const diffInMs = now.getTime() - _date;
        const diffInMinutes = Math.floor(diffInMs / 60000);

        if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        } else if (now.toDateString() === __date.toDateString()) {
            const fullTime = __date.toTimeString().split(' ')[0];
            return fullTime.substring(0, fullTime.length - 3);
        } else {
            const fullDateTime = `${String(__date.getDate()).padStart(2, '0')}/${String(__date.getMonth() + 1).padStart(2, '0')}/${__date.getFullYear()} ${__date.toTimeString().split(' ')[0]}`;
            return fullDateTime.substring(0, fullDateTime.length - 3);
        }
    }

    function messageInputKeyDown(e: any) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function handleFileSelect(event: any) {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const files = event.target.files;
        for (const file of files) {
            const messageData = {
                chater: {
                    name: currentUserInfo.user.fullName,
                    avatar: currentUserInfo.user.publicImageUrl,
                    time: new Date().getTime()
                },
                content: `File attached: ${file.name}`,
                type: 'sent',
                mediaType: null,
                mediaUrl: null
            }
            setMessageDataList(arr => [...arr, messageData]);
        }
        event.target.value = '';
    }

    function handleImageSelect(event: any) {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                const messageData = {
                    chater: {
                        name: currentUserInfo.user.fullName,
                        avatar: currentUserInfo.user.publicImageUrl,
                        time: new Date().getTime()
                    },
                    content: `Image sent:`,
                    type: 'sent',
                    mediaType: 'image',
                    mediaUrl: e.target.result
                }
                setMessageDataList(arr => [...arr, messageData]);
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    function handleVideoSelect(event: any) {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                const messageData = {
                    chater: {
                        name: currentUserInfo.user.fullName,
                        avatar: currentUserInfo.user.publicImageUrl,
                        time: new Date().getTime()
                    },
                    content: `Video sent:`,
                    type: 'sent',
                    mediaType: 'video',
                    mediaUrl: e.target.result
                }
                setMessageDataList(arr => [...arr, messageData]);
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    async function toggleRecording() {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event: any) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const messageData = {
                        chater: {
                            name: currentUserInfo.user.fullName,
                            avatar: currentUserInfo.user.publicImageUrl,
                            time: new Date().getTime()
                        },
                        content: `Voice message:`,
                        type: 'sent',
                        mediaType: 'audio',
                        mediaUrl: audioUrl
                    }
                    setMessageDataList(arr => [...arr, messageData]);
                };

                mediaRecorder.start();
                isRecording = true;
                setRecordButtonText("⏹️ Stop");
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Error accessing microphone. Please check permissions.');
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            setRecordButtonText("🎤 Record");
        }
    }

    async function sendMessage() {
        if (currentCaseData == null || currentUserInfo == null || currentCaseData.channelId == null) {
            alert('error');
            return;
        }
        const message = messageInputRef.current?.value;
        if (message) {
            messageInputRef.current.value = '';
            await cxoneDigitalContact.reply({
                messageContent: { type: 'TEXT', payload: { text: message } },
                recipients: [],
                thread: { idOnExternalPlatform: currentCaseData.threadIdOnExternalPlatform }
            }, currentCaseData.channelId, uuidv4())
        }
    }

    function handleSetMessageData(messages: CXoneMessageArray) {
        messages.forEach(m => {
            if (m.direction === 'inbound') {
                const messageData = {
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
                setMessageDataList(arr => [...arr, messageData]);
            } else {
                let avatar = defaultUserAvatar;
                if (m.authorUser.id === currentUserInfo?.user.id) {
                    avatar = currentUserInfo.user.publicImageUrl;
                }
                const messageData = {
                    chater: {
                        name: `${m.authorUser.firstName} ${m.authorUser.surname}`,
                        avatar: avatar,
                        time: new Date(m.createdAt).getTime()
                    },
                    content: m.messageContent.text,
                    type: 'sent',
                    mediaType: null,
                    mediaUrl: null
                }
                setMessageDataList(arr => [...arr, messageData]);
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
            window.location.reload();
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

    async function updateCaseStatus(event: any) {
        console.log('updateCaseStatus', event);
        if (currentCaseData != null) {
            const cxoneDigitalContact = new CXoneDigitalContact();
            cxoneDigitalContact.caseId = currentCaseData.id;
            await cxoneDigitalContact.changeStatus(event.target.value);
        }
    }

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        _currentCaseData = caseData;
        setCurrentCaseData(caseData);
        setMessageDataList([]);
        if (caseData?.id != null) {
            const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
            handleSetMessageData(conversationHistory.messages);
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        _currentCallContactData = callContactData;
        _currentVoiceContactData = voiceContactDataArray.filter(item => item.interactionId === callContactData?.interactionId)[0];
        setCurrentCallContactData(callContactData);
        setCurrentVoiceContactData(_currentVoiceContactData);
        setMessageDataList([]);
    }

    function handleAuthButtonClick() {
        cxoneAuth.init(authSetting);
        cxoneAuth.getAuthorizeUrl('page', 'S256').then((authUrl: string) => {
            window.location.href = authUrl;
        });
    }

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
    if (!ACDSessionManager.instance.hasSessionId) {
        return (
            <div className="app" style={{ display: 'block', height: 'auto' }}>
                <SessionConnectionSelect></SessionConnectionSelect>
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
                <span id="sidebar-collapse-close" className="sidebar-collapse-btn" onClick={closeSidebar}>&lt;&lt;</span>
                <span id="sidebar-collapse-open" className="sidebar-collapse-btn" onClick={openSidebar}>&gt;&gt;</span>
                <div className="agent-profile">
                    <div className="profile-info">
                        <img src={currentUserInfo?.user?.publicImageUrl ?? defaultUserAvatar} alt="Agent" className="avatar" />
                        <div>
                            <div className="profile-info-name">{currentUserInfo?.user?.fullName ?? 'N/A'}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }} data-starttime={agentStatus?.agentStateData?.StartTime}>00:00:00</div>
                        </div>
                    </div>
                    <div className="agent-status">
                        <select className="status-selector" onChange={updateAgentState} value={JSON.stringify(currentState)}>
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
                </div>
                {callContactDataArray.map((callContactData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCallContactData != null && currentCallContactData.interactionId === callContactData.interactionId ? 'active' : '')}`} onClick={() => selectCallContactItem(callContactData)}>
                            <div className="case-preview">
                                <img src={defaultUserAvatar} alt="" className="avatar"></img>
                                <div className="preview-details">
                                    <div>{callContactData.ani}</div>
                                    <div className="preview-message">{callContactData.status}</div>
                                    <div className="message-time" data-starttime={callContactData.startTime}>00:00:00</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
                {caseDataList.map((caseData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCaseData != null && currentCaseData.id === caseData.id ? 'active' : '')}`} onClick={() => selectCaseItem(caseData)}>
                            <div className="case-preview">
                                <img src={caseData.authorEndUserIdentity.image} alt="" className="avatar"></img>
                                <div className="preview-details">
                                    <div>{caseData.authorEndUserIdentity.fullName}</div>
                                    <div className="preview-message">{caseData.preview}</div>
                                    <div className="message-time time-auto-update-off" data-time={caseData.id}>#{caseData.id}: {`${caseData.channelId}`}</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
            <div className="chat-container">
                {currentCallContactData != null ? (
                    <React.Fragment>
                        <div className="chat-header">
                            <div className="profile-info">
                                <img src={defaultUserAvatar} alt="Case" className="avatar" />
                                <div>
                                    <div className="profile-info-name">{currentCallContactData.ani}</div>
                                    <div className="message-time" data-starttime={currentCallContactData.startTime}>00:00:00</div>
                                </div>
                            </div>
                        </div>
                        <div className="chat-messages" id="chatMessages">
                            <Call currentCallContactData={currentCallContactData} currentVoiceContactData={currentVoiceContactData}></Call>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <div className="chat-header">
                            <div className="profile-info">
                                <img src={currentCaseData?.authorEndUserIdentity?.image ?? defaultUserAvatar} alt="Case" className="avatar" />
                                <div>
                                    <div className="profile-info-name">{currentCaseData?.authorEndUserIdentity?.fullName ?? 'N/A'}</div>
                                    <div className="message-time">#{currentCaseData?.id}:{currentCaseData?.status} {currentCaseData?.channelId ?? 'N/A'}</div>
                                </div>
                            </div>
                        </div>
                        <div ref={messageListDivRef} className="chat-messages" id="chatMessages">
                            {messageDataList.filter(messageData => (messageData.content ?? '') !== '').map((messageData, index) => {
                                let media: any = null;
                                if (messageData.mediaType && messageData.mediaUrl) {
                                    switch (messageData.mediaType) {
                                        case 'image':
                                            media = <div className="media-content"><img src={messageData.mediaUrl} alt=""></img></div>;
                                            break;
                                        case 'video':
                                            media = <div className="media-content"><video controls={true} src={messageData.mediaUrl}></video></div>
                                            break;
                                        case 'audio':
                                            media = <div className="media-content"><audio controls={true} src={messageData.mediaUrl}></audio></div>
                                            break;
                                        default:
                                            break;
                                    }
                                }
                                return (
                                    <React.Fragment key={index}>
                                        <div className={`message ${messageData.type}`}>
                                            <div className="message-info">
                                                <img src={messageData.chater.avatar} alt="" className="avatar"></img>
                                            </div>
                                            <div className="message-content">
                                                {messageData.content}
                                                {media}
                                                <div className="message-name-time">
                                                    <span>{messageData.chater.name}</span> • <span className="time-auto-update" data-time={messageData.chater.time}>{formatDateTime(messageData.chater.time)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                )
                            })}
                        </div>
                        <div className={`chat-input ${(currentCaseData == null || currentCaseData.status === 'closed' ? 'chat-input-disabled' : '')}`}>
                            <div className="attachment-options">
                                <input onChange={handleFileSelect} type="file" id="fileInput" ref={fileInputRef} multiple style={{ display: 'none' }} />
                                <button onClick={() => fileInputRef?.current?.click()} className="attachment-btn">📎 File</button>

                                <button onClick={toggleRecording} className="attachment-btn" id="recordButton">{recordButtonText}</button>

                                <input onChange={handleImageSelect} type="file" id="imageInput" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} />
                                <button onClick={() => imageInputRef?.current?.click()} className="attachment-btn">🖼️ Image</button>

                                <input onChange={handleVideoSelect} type="file" id="videoInput" ref={videoInputRef} accept="video/*" style={{ display: 'none' }} />
                                <button onClick={() => videoInputRef?.current?.click()} className="attachment-btn">🎥 Video</button>

                                <select value={currentCaseData?.status} onChange={updateCaseStatus}>
                                    {[{ id: 'new', name: 'New' }, { id: 'open', name: 'Open' }, { id: 'pending', name: 'Pending' }, { id: 'resolved', name: 'Resolved' }, { id: 'escalated', name: 'Escalated' }, { id: 'closed', name: 'Closed' }]
                                        .map((status, index) => {
                                            return (
                                                <React.Fragment key={index}>
                                                    <option disabled={(currentCaseData?.status === 'closed' || (currentCaseData != null && status.id === 'new'))} value={status.id}>{status.name}</option>
                                                </React.Fragment>
                                            );
                                        })}
                                </select>
                            </div>
                            <div className="input-container">
                                <textarea ref={messageInputRef} onKeyDown={messageInputKeyDown} className="message-input" placeholder="Type a message..." id="messageInput"></textarea>
                                <button className="send-btn" onClick={sendMessage}>Send</button>
                            </div>
                        </div>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
};
export default App;