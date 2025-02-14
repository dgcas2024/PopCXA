import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { CXoneAcdClient, CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    CallContactEvent,
    CXoneMessageArray,
    CXoneCase
} from "@nice-devone/common-sdk";
import {
    CXoneAuth,
    AuthStatus,
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    CXoneDigitalContact,
    DigitalService,
} from "@nice-devone/digital-sdk";
import {  } from "@nice-devone/voice-sdk";
import { } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';
import Call from "./components/Call";

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeCaseDetail = () => {
    const cxoneAuth = CXoneAuth.instance;
    const digitalService = new DigitalService();
    const cxoneDigitalContact = new CXoneDigitalContact();

    const [authState, setAuthState] = useState("");
    const [, setAuthToken] = useState("");

    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const currentUserInfoRef = useRef(currentUserInfo);

    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);
    const currentCallContactDataRef = useRef(currentCallContactData);

    const [currentVoiceContactData, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);
    const currentVoiceContactDataRef = useRef(currentVoiceContactData);

    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);
    const currentCaseDataRef = useRef(currentCaseData);


    const [messageDataArray, setMessageDataArray] = useState<Array<{ chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null, mediaUrl: string | null }>>([]);

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");

    useEffect(() => {
        currentUserInfoRef.current = currentUserInfo;
        currentCallContactDataRef.current = currentCallContactData;
        currentVoiceContactDataRef.current = currentVoiceContactData;
        currentCaseDataRef.current = currentCaseData;
    }, [currentCallContactData, currentCaseData, currentUserInfo, currentVoiceContactData]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMessageDataArray([]);
        try {
            const caseData = (JSON.parse(localStorage.getItem('currentCaseData') ?? '{}') as CXoneCase);
            if (caseData?.id) {
                setCurrentCaseData(caseData);
                const run = async (caseData: CXoneCase) => {
                    const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
                    handleSetMessageData(conversationHistory.messages);
                }
                run(caseData);
            }
        } catch { }
        try {
            const callContactData = (JSON.parse(localStorage.getItem('currentCallContactData') ?? '{}') as CallContactEvent);
            const voiceContactData = (JSON.parse(localStorage.getItem('currentVoiceContactData') ?? '{}') as CXoneVoiceContact);
            if (callContactData?.interactionId) {
                setCurrentCallContactData(callContactData);
                setCurrentVoiceContactData(voiceContactData);
            }
        } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setupAcd = async function () {
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
            if (currentVoiceContactDataRef.current?.interactionId === voiceContactEvent.interactionId) {
                setCurrentVoiceContactData(voiceContactEvent);
                if (voiceContactEvent.status === 'Disconnected') {
                    setCurrentVoiceContactData(null);
                    // xxxxxxx đóng
                }
            }
        });

        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            if (currentCallContactDataRef.current?.interactionId === callContactEvent.interactionId) {
                setCurrentCallContactData(callContactEvent);
                if (callContactEvent.status === 'Disconnected') {
                    setCurrentCallContactData(null);
                    // xxxxxxx đóng
                }
            }
        });

        const cuser = await digitalService.getDigitalUserDetails() as any;
        setCurrentUserInfo(cuser);
        console.log(cuser);

        const digital = async function () {
            CXoneDigitalClient.instance.initDigitalEngagement();
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                // Nothing
            });
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                if (currentCaseDataRef.current?.id === digitalContactEvent.caseId) {
                    if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                        setCurrentCaseData(digitalContactEvent.case);
                        if (digitalContactEvent.case.status === 'closed') {
                            setCurrentCaseData(null);
                            // xxxxxxx đóng
                        }
                    } else {
                        if (digitalContactEvent.isCaseAssigned) {
                            setMessageDataArray([]);
                            handleSetMessageData(digitalContactEvent.messages);
                        } else {
                            setCurrentCaseData(null);
                            // xxxxxxx đóng
                        }
                    }
                }
            });
        }
        await digital();
    }

    useEffect(() => {
        console.log('useEffect[messageDataList]...');
        if (messageListDivRef?.current) {
            messageListDivRef.current.scrollTop = 9999;
        }
    }, [messageDataArray]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            name: currentUserInfoRef.current.user.fullName,
                            avatar: currentUserInfoRef.current.user.publicImageUrl,
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

    async function updateCaseStatus(event: any) {
        console.log('updateCaseStatus', event);
        if (currentCaseDataRef.current != null) {
            const cxoneDigitalContact = new CXoneDigitalContact();
            cxoneDigitalContact.caseId = currentCaseDataRef.current.id;
            await cxoneDigitalContact.changeStatus(event.target.value);
        }
    }

    if (authState !== "AUTHENTICATED") {
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: '#fff' }}>
                    <h4>{authState}</h4>
                </div>
            </div>
        )
    }

    if (!ACDSessionManager.instance.hasSessionId) {
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: '#fff' }}>
                    <h4>SESSION NOT STARTED YET</h4>
                </div>
            </div>
        )
    }

    return (
        <div className={`app`}>
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
export default IframeCaseDetail;