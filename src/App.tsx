/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useRef, useState } from "react";
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
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
    UserInfo
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
import React from "react";

const digitalService = new DigitalService();
const cxoneDigitalContact = new CXoneDigitalContact();

const App = () => {
    const cxoneAuth = CXoneAuth.instance;

    const [authState, setAuthState] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);
    const [unavailableCodes, setUnavailableCodes] = useState<Array<UnavailableCode>>([]);

    const authSetting: AuthSettings = {
        cxoneHostname: process.env.REACT_APP__CXONE_HOST_NAME || '',
        clientId: process.env.REACT_APP__CXONE_CLIENT_ID || '',
        redirectUri: process.env.REACT_APP__CXONE_AUTH_REDIRECT_URL || '',
    };

    useEffect(() => {
        cxoneAuth.onAuthStatusChange.subscribe((data) => {
            switch (data.status) {
                case AuthStatus.AUTHENTICATING:
                    setAuthState("AUTHENTICATING");
                    setCurrentUserInfo(undefined);
                    break;
                case AuthStatus.AUTHENTICATED:
                    setAuthState("AUTHENTICATED");
                    if (window.location.pathname !== '/') {
                        window.location.href = '/';
                    }
                    setAuthToken((data.response as AuthToken).accessToken);

                    const user = async function () {
                        const me = await digitalService.getDigitalUserDetails() as any;
                        setCurrentUserInfo(me);
                        console.log('Me', me);
                    }
                    user();

                    const digital = async function () {
                        // Digital SDK consumption
                        CXoneDigitalClient.instance.initDigitalEngagement();
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((eventData) => {
                            console.log("onDigitalContactNewMessageEvent", eventData);
                        });
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContact) => {
                            console.log("onDigitalContactEvent", digitalContact);
                        });
                        const cases = await digitalService.getDigitalContactSearchResult({
                            sortingType: SortingType.DESCENDING,
                            sorting: 'updatedAt'
                        }, true, true);
                        console.log('Case list', cases);
                        (cases.data as Array<any>).reverse().forEach(addCustomerChatItem);
                    }
                    digital();

                    // ACD SDK consumption
                    const acd = async function () {
                        CXoneAcdClient.instance.initAcdEngagement();

                        if (!ACDSessionManager.instance.hasSessionId) {
                            try {
                                const start_ss = await CXoneAcdClient.instance.session.startSession({
                                    stationId: '',
                                    stationPhoneNumber: 'WebRTC'
                                });
                                console.log('Start session', start_ss);
                            } catch { }
                        }
                        const join_ss = await CXoneAcdClient.instance.session.joinSession();
                        console.log('Join session', join_ss);
                        CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
                            const serverTime = DateTimeUtilService.getServerTimestamp();
                            const originStartTime = new Date(agentState.agentStateData.StartTime).getTime();
                            const delta = new Date().getTime() - serverTime;
                            agentState.agentStateData.StartTime = new Date(originStartTime + delta);
                            setAgentStatus(agentState);
                            console.log('agentState', agentState);
                        });
                        const _unavailableCodes = await CXoneAcdClient.instance.session.agentStateService.getTeamUnavailableCodes();
                        if (Array.isArray(_unavailableCodes)) {
                            if (_unavailableCodes.filter(item => item.isActive && !item.isAcw).length === 0) {
                                _unavailableCodes.push({
                                    isActive: true,
                                    isAcw: false,
                                    reason: 'Unavailable'
                                } as UnavailableCode);
                            }
                            setUnavailableCodes(_unavailableCodes);
                        }
                    }
                    acd();
                    break;
                case AuthStatus.NOT_AUTHENTICATED:
                    setAuthState("NOT_AUTHENTICATED");
                    setCurrentUserInfo(undefined);
                    break;
                case AuthStatus.AUTHENTICATION_FAILED:
                    setAuthState("AUTHENTICATION_FAILED");
                    setCurrentUserInfo(undefined);
                    break;
                default:
                    setCurrentUserInfo(undefined);
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
            addMessage({ name: currentUserInfo.user.fullName, avatar: currentUserInfo.user.publicImageUrl, time: new Date().getTime() }, `File attached: ${file.name}`, 'sent');
            event.target.value = '';
        }
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
                addMessage({ name: currentUserInfo.user.fullName, avatar: currentUserInfo.user.publicImageUrl, time: new Date().getTime() }, 'Image sent:', 'sent', 'image', e.target.result);
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
                addMessage({ name: currentUserInfo.user.fullName, avatar: currentUserInfo.user.publicImageUrl, time: new Date().getTime() }, 'Video sent:', 'sent', 'video', e.target.result);
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        }
    }

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");
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
                    addMessage({ name: currentUserInfo.user.fullName, avatar: currentUserInfo.user.publicImageUrl, time: new Date().getTime() }, 'Voice message:', 'sent', 'audio', audioUrl);
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

    const [messages, setMessages] = useState<Array<any>>([]);
    useEffect(() => {
        if (messagesDivRef?.current) {
            messagesDivRef.current.scrollTop = 9999;
        }
    }, [messages]);
    function addMessage(chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null = null, mediaUrl: string | null = null) {
        if (content !== "") {
            let media: any = null;
            if (mediaType && mediaUrl) {
                switch (mediaType) {
                    case 'image':
                        media = <div className="media-content"><img src={mediaUrl} alt=""></img></div>;
                        break;
                    case 'video':
                        media = <div className="media-content"><video controls={true} src={mediaUrl}></video></div>
                        break;
                    case 'audio':
                        media = <div className="media-content"><audio controls={true} src={mediaUrl}></audio></div>
                        break;
                }
            }
            const html = (
                <div className={`message ${type}`}> {/*messageDiv*/}
                    <div className="message-info"> {/*messageInfo*/}
                        <img src={chater.avatar} alt="" className="avatar"></img>
                    </div>
                    <div className="message-content"> {/*messageContent*/}
                        {content}
                        {media}
                        <div className="message-name-time">
                            <span>{chater.name}</span> • <span className="time-auto-update" data-time={chater.time}>{formatDateTime(chater.time)}</span>
                        </div>
                    </div>
                </div>
            )
            setMessages(arr => {
                return [...arr, html];
            });
        }
    }

    function sendMessage() {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const message = messageInputRef.current?.value;
        if (message) {
            addMessage({ name: currentUserInfo.user.fullName, avatar: currentUserInfo.user.publicImageUrl, time: new Date().getTime() }, message, 'sent');
            messageInputRef.current.value = '';
            // Simulate customer reply after 1-3 seconds
            setTimeout(() => {
                const replies = [
                    "Thank you for your message!",
                    "I understand, let me check that for you.",
                    "Could you please provide more details?",
                    "I'll look into this right away."
                ];
                const randomReply = replies[Math.floor(Math.random() * replies.length)];
                addMessage({ name: currentCaseData.authorEndUserIdentity.fullName, avatar: currentCaseData.authorEndUserIdentity.image, time: new Date().getTime() }, randomReply, 'received');
            }, 1000 + Math.random() * 2000);
        }
    }

    const [currentCaseData, setCurrentCaseData] = useState<any>(null);
    async function selectCustomerChatItem(caseData: any) {
        setMessages([]);

        const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
        (conversationHistory.messages as Array<{
            authorEndUserIdentity: { fullName: string, image: string },
            authorUser: { firstName: string, surname: string },
            direction: 'inbound' | 'outbound',
            messageContent: { type: string, text: string },
            sentStatus: string,
            createdAt: string
        }>).forEach(m => {
            if (m.direction === 'inbound') {
                addMessage({
                    name: m.authorEndUserIdentity.fullName,
                    avatar: m.authorEndUserIdentity.image,
                    time: new Date(m.createdAt).getTime()
                }, m.messageContent.text, 'received');
            } else {
                addMessage({
                    name: `${m.authorUser.firstName} ${m.authorUser.surname}`,
                    avatar: defaultUserAvatar,
                    time: new Date(m.createdAt).getTime()
                }, m.messageContent.text, 'sent');
            }
        });

        setCurrentCaseData(caseData);
    }

    const [customerChatItems, setCustomerChatItems] = useState<Array<any>>([]);
    useEffect(() => {
        if (customersDivRef?.current) {
            customersDivRef.current.scrollTop = 0;
        }
    }, [customerChatItems]);
    function addCustomerChatItem(caseData: any) {
        const html = (
            <div className="customer-item" onClick={() => selectCustomerChatItem(caseData)}>
                <div className="customer-preview">
                    <img src={caseData.authorEndUserIdentity.image} alt="" className="avatar"></img>
                    <div className="preview-details">
                        <div>{caseData.authorEndUserIdentity.fullName}</div>
                        <div className="preview-message">{caseData.preview}</div>
                        <div className="message-time time-auto-update-off" data-time={caseData.id}>#{caseData.id}: {`${caseData.channelId}`}</div>
                    </div>
                </div>
            </div>
        )
        setCustomerChatItems(arr => {
            return [html, ...arr];
        });
    }

    function closeSidebar() {
        appDivRef.current?.classList?.remove('sidebar-collapse-open');
        localStorage.setItem('sidebar-collapse-open', '0');
    }

    function openSidebar() {
        appDivRef.current?.classList?.add('sidebar-collapse-open');
        localStorage.setItem('sidebar-collapse-open', '1');
    }

    async function updateAgentState(event: any) {
        console.log(event);
        await CXoneAcdClient.instance.session.agentStateService.setAgentState({
            state: event.target.value === '0' ? 'Available' : 'Unavailable',
            reason: event.target.value === '0' ? '' : event.target.value,
            isACW: event.target.value === '0' ? false : event.target.value.startsWith('ACW -')
        });
    }

    const appDivRef = useRef<HTMLDivElement>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messagesDivRef = useRef<HTMLDivElement>(null);
    const customersDivRef = useRef<HTMLDivElement>(null);

    const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

    const sidebarCollapse = !localStorage.getItem('sidebar-collapse-open') || localStorage.getItem('sidebar-collapse-open') === '1' ? 'sidebar-collapse-open' : '';

    function handleAuthButtonClick() {
        cxoneAuth.init(authSetting);
        cxoneAuth.getAuthorizeUrl('page', 'S256').then((authUrl: string) => {
            window.location.href = authUrl;
        });
    }

    if (authState !== "AUTHENTICATED") {
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

    return (
        <div ref={appDivRef} className={`app ${sidebarCollapse}`}>
            <div ref={customersDivRef} className="customers-list sidebar-collapse">
                <span id="sidebar-collapse-close" className="sidebar-collapse-btn" onClick={closeSidebar}>&lt;&lt;</span>
                <span id="sidebar-collapse-open" className="sidebar-collapse-btn" onClick={openSidebar}>&gt;&gt;</span>
                <div className="agent-profile">
                    <div className="profile-info">
                        <img src={currentUserInfo?.user?.publicImageUrl ?? 'https://app-eu1.brandembassy.com/img/user-default.png'} alt="Agent" className="avatar" />
                        <div>
                            <div>{currentUserInfo?.user?.fullName ?? 'N/A'}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }} data-starttime={agentStatus?.agentStateData?.StartTime}>00:00:00</div>
                        </div>
                    </div>
                    <div className="agent-status">
                        <select className="status-selector" onChange={updateAgentState} value={agentStatus?.currentState?.state?.toLowerCase() === 'available' ? '0' : agentStatus?.currentState?.reason}>
                            <option value="0">Available</option>
                            {/*{unavailableCodes.filter(item => item.isActive && item.isAcw).map((item, index) => {*/}
                            {/*    return (*/}
                            {/*        <React.Fragment key={index}>*/}
                            {/*            <option value={item.reason}>ACW - {item.reason}</option>*/}
                            {/*        </React.Fragment>*/}
                            {/*    )*/}
                            {/*})}*/}
                            {unavailableCodes.filter(item => item.isActive && !item.isAcw).map((item, index) => {
                                return (
                                    <React.Fragment key={index}>
                                        <option value={item.reason}>Unavailable - {item.reason}</option>
                                    </React.Fragment>
                                )
                            })}
                            <option disabled value="">Unavailable -</option>
                        </select>
                    </div>
                </div>
                {customerChatItems.map((item, index) => (
                    <React.Fragment key={index}>
                        {item}
                    </React.Fragment>
                ))}
            </div>
            <div className="chat-container">
                <div className="chat-header">
                    <div className="profile-info">
                        <img src={currentCaseData?.authorEndUserIdentity?.image ?? defaultUserAvatar} alt="Customer" className="avatar" />
                        <div>
                            <div className="profile-info-name">{currentCaseData?.authorEndUserIdentity?.fullName ?? 'N/A'}</div>
                            <div className="message-time">#{currentCaseData?.id}: {currentCaseData?.channelId ?? 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div ref={messagesDivRef} className="chat-messages" id="chatMessages">
                    {messages.map((item, index) => (
                        <React.Fragment key={index}>
                            {item}
                        </React.Fragment>
                    ))}
                </div>

                <div className="chat-input">
                    <div className="attachment-options">
                        <input onChange={handleFileSelect} type="file" id="fileInput" ref={fileInputRef} multiple style={{ display: 'none' }} />
                        <button onClick={() => fileInputRef?.current?.click()} className="attachment-btn">📎 File</button>

                        <button onClick={toggleRecording} className="attachment-btn" id="recordButton">{recordButtonText}</button>

                        <input onChange={handleImageSelect} type="file" id="imageInput" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} />
                        <button onClick={() => imageInputRef?.current?.click()} className="attachment-btn">🖼️ Image</button>

                        <input onChange={handleVideoSelect} type="file" id="videoInput" ref={videoInputRef} accept="video/*" style={{ display: 'none' }} />
                        <button onClick={() => videoInputRef?.current?.click()} className="attachment-btn">🎥 Video</button>
                    </div>
                    <div className="input-container">
                        <textarea ref={messageInputRef} onKeyDown={messageInputKeyDown} className="message-input" placeholder="Type a message..." id="messageInput"></textarea>
                        <button className="send-btn" onClick={sendMessage}>Send</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default App;