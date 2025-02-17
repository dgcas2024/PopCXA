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
    CXoneMessageArray,
    AgentLegEvent
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
import { CXoneClient, ContactService, VoiceControlService, AgentLegService } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';
import Call from "./components/Call";
import SessionConnectionSelect from "./components/SessionConnectionSelect";

//let _currentCaseData: any = null;
//let _currentCallContactData: CallContactEvent | null = null;
//let _currentVoiceContactData: CXoneVoiceContact | null = null;

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
    const [, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);

    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const currentUserInfoRef = useRef(currentUserInfo);

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);
    const callContactDataArrayRef = useRef(callContactDataArray);
    const currentCallContactDataRef = useRef(currentCallContactData);

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);
    const [currentVoiceContactData, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);
    const voiceContactDataArrayRef = useRef(voiceContactDataArray);
    const currentVoiceContactDataRef = useRef(currentVoiceContactData);

    const [caseDataArray, setCaseDataArray] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);
    const currentCaseDataRef = useRef(currentCaseData);

    const [unavailableCodeArray, setUnavailableCodeArray] = useState<Array<UnavailableCode>>([]);
    
    const [messageDataArray, setMessageDataArray] = useState<Array<{ chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null, mediaUrl: string | null }>>([]);

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");


    useEffect(() => {
        currentUserInfoRef.current = currentUserInfo;
        callContactDataArrayRef.current = callContactDataArray;
        currentCallContactDataRef.current = currentCallContactData;
        voiceContactDataArrayRef.current = voiceContactDataArray;
        currentVoiceContactDataRef.current = currentVoiceContactData;
        currentCaseDataRef.current = currentCaseData;

    }, [callContactDataArray, currentCallContactData, currentCaseData, currentUserInfo, currentVoiceContactData, voiceContactDataArray]);

    const appDivRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);
    const caseListDivRef = useRef<HTMLDivElement>(null);

    const [dialNumber, setDialNumber] = useState('+84328523152');

    const setupAcd = async function () {
        CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(agentState.agentStateData.StartTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //agentState.agentStateData.StartTime = new Date(originStartTime + delta);
            setAgentStatus(agentState);
            console.log('agentState', agentState);
        });

        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
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

        const digital = async function () {
            const refreshCaseArray = async function () {
                const _caseDataArray = await digitalService.getDigitalContactSearchResult({
                    sortingType: SortingType.DESCENDING,
                    sorting: 'createdAt',
                    inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
                    status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
                }, true, true);
                console.log('Case data Array', _caseDataArray);
                setCaseDataArray([]);
                (_caseDataArray.data as Array<any>).reverse().forEach(c => setCaseDataArray(arr => [c, ...arr]));
            }
            // Digital SDK consumption
            CXoneDigitalClient.instance.initDigitalEngagement();
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
            });
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                console.log("onDigitalContactEvent", digitalContactEvent);
                refreshCaseArray();
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
            await refreshCaseArray();
        }
        await digital();

        CXoneAcdClient.instance.session.agentLegEvent.subscribe((data: AgentLegEvent) => {
            console.log('agentLegEvent', data);
            if (data.status === "Dialing") {
                CXoneVoiceClient.instance.triggerAutoAccept(data.agentLegId);
            }
        });
    }

    useEffect(() => {
        console.log('useEffect[messageDataArray]...');
        if (messageListDivRef?.current) {
            messageListDivRef.current.scrollTop = 9999;
        }
    }, [messageDataArray]);

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

                    // ACD SDK consumption
                    const acd = async function () {
                        CXoneAcdClient.instance.initAcdEngagement();
                        if (ACDSessionManager.instance.hasSessionId) {
                            const join_ss = await CXoneAcdClient.instance.session.joinSession();
                            console.log('Join session', join_ss);
                            await setupAcd();
                        }
                    }
                    acd();
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
        if (currentCaseDataRef.current == null || currentUserInfoRef.current == null) {
            alert('error');
            return;
        }
        const files = event.target.files;
        for (const file of files) {
            const messageData = {
                chater: {
                    name: currentUserInfoRef.current.user.fullName,
                    avatar: currentUserInfoRef.current.user.publicImageUrl,
                    time: new Date().getTime()
                },
                content: `File attached: ${file.name}`,
                type: 'sent',
                mediaType: null,
                mediaUrl: null
            }
            setMessageDataArray(arr => [...arr, messageData]);
        }
        event.target.value = '';
    }

    function handleImageSelect(event: any) {
        if (currentCaseDataRef.current == null || currentUserInfoRef.current == null) {
            alert('error');
            return;
        }
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                const messageData = {
                    chater: {
                        name: currentUserInfoRef.current.user.fullName,
                        avatar: currentUserInfoRef.current.user.publicImageUrl,
                        time: new Date().getTime()
                    },
                    content: `Image sent:`,
                    type: 'sent',
                    mediaType: 'image',
                    mediaUrl: e.target.result
                }
                setMessageDataArray(arr => [...arr, messageData]);
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    function handleVideoSelect(event: any) {
        if (currentCaseDataRef.current == null || currentUserInfoRef.current == null) {
            alert('error');
            return;
        }
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                const messageData = {
                    chater: {
                        name: currentUserInfoRef.current.user.fullName,
                        avatar: currentUserInfoRef.current.user.publicImageUrl,
                        time: new Date().getTime()
                    },
                    content: `Video sent:`,
                    type: 'sent',
                    mediaType: 'video',
                    mediaUrl: e.target.result
                }
                setMessageDataArray(arr => [...arr, messageData]);
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    async function toggleRecording() {
        if (currentCaseDataRef.current == null || currentUserInfoRef.current == null) {
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
                    setMessageDataArray(arr => [...arr, messageData]);
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
        if (currentCaseDataRef.current == null || currentUserInfoRef.current == null || currentCaseDataRef.current.channelId == null) {
            alert('error');
            return;
        }
        const message = messageInputRef.current?.value;
        if (message) {
            messageInputRef.current.value = '';
            await cxoneDigitalContact.reply({
                messageContent: { type: 'TEXT', payload: { text: message } },
                recipients: [],
                thread: { idOnExternalPlatform: currentCaseDataRef.current.threadIdOnExternalPlatform }
            }, currentCaseDataRef.current.channelId, uuidv4())
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
                setMessageDataArray(arr => [...arr, messageData]);
            } else {
                let avatar = defaultUserAvatar;
                if (m.authorUser.id === currentUserInfoRef.current?.user.id) {
                    avatar = currentUserInfoRef.current.user.publicImageUrl;
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
                setMessageDataArray(arr => [...arr, messageData]);
            }
        });
    }

    async function updateAgentState(event: any) {
        if (event.target.value === '0000') {
            const end_ss = await CXoneAcdClient.instance.session.endSession({
                endContacts: true,
                forceLogoff: true,
                ignorePersonalQueue: true
            });
            console.log('End session', end_ss)
            await setupAcd();
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
        if (currentCaseDataRef.current != null) {
            const cxoneDigitalContact = new CXoneDigitalContact();
            cxoneDigitalContact.caseId = currentCaseDataRef.current.id;
            await cxoneDigitalContact.changeStatus(event.target.value);
        }
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
                <SessionConnectionSelect setupAcd={setupAcd}></SessionConnectionSelect>
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
                                    <div className="preview-message">{callContactData.status}</div>
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
                            {messageDataArray.filter(messageData => (messageData.content ?? '') !== '').map((messageData, index) => {
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

                                <select value={currentCaseData?.status} onChange={updateCaseStatus} style={{
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