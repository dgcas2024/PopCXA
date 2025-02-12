import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import { CXoneAcdClient, CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    CallContactEvent,
    CXoneCase,
    CXoneMessageArray
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

let _currentCaseData: any = null;

let _currentCallContactData: CallContactEvent | null = null;

let _currentVoiceContactData: CXoneVoiceContact | null = null;

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeCaseDetail = () => {
    if (localStorage.getItem('_currentCaseData')) {
        _currentCaseData = JSON.parse(localStorage.getItem('_currentCaseData') ?? '{}');
    }
    if (localStorage.getItem('_currentCallContactData')) {
        _currentCallContactData = JSON.parse(localStorage.getItem('_currentCallContactData') ?? '{}') as CallContactEvent;
    }
    if (localStorage.getItem('_currentVoiceContactData')) {
        _currentVoiceContactData = JSON.parse(localStorage.getItem('_currentVoiceContactData') ?? '{}') as CXoneVoiceContact;
    }

    const cxoneAuth = CXoneAuth.instance;
    const digitalService = new DigitalService();
    const cxoneDigitalContact = new CXoneDigitalContact();

    const [authState, setAuthState] = useState("");
    const [, setAuthToken] = useState("");

    const [currentUserInfo, setCurrentUserInfo] = useState<any>();

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);

    const [messageDataList, setMessageDataList] = useState<Array<{ chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null, mediaUrl: string | null }>>([]);

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);

    const setupAcd = async function () {
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
            setVoiceContactDataArray(voiceContactDataArray.filter(item => item.interactionId !== voiceContactEvent.interactionId));
            if (voiceContactEvent.status !== 'Disconnected') {
                setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
            }
        });

        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            setCallContactDataArray(callContactDataArray.filter(item => item.interactionId !== callContactEvent.interactionId));
            if (callContactEvent.status !== 'Disconnected') {
                setCallContactDataArray(arr => [...arr, callContactEvent]);
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
                console.log("onDigitalContactEvent", digitalContactEvent);
                if (_currentCaseData != null && _currentCaseData.id === digitalContactEvent.caseId) {
                    if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
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
        }
        await digital();
    }

    useEffect(() => {
        console.log('useEffect[messageDataList]...');
        if (messageListDivRef?.current) {
            messageListDivRef.current.scrollTop = 9999;
        }
    }, [messageDataList]);

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

        selectCaseItem(_currentCaseData);
        selectCallContactItem(_currentCallContactData);
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
        if (_currentCaseData == null || currentUserInfo == null) {
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
        if (_currentCaseData == null || currentUserInfo == null) {
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
        if (_currentCaseData == null || currentUserInfo == null) {
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
        if (_currentCaseData == null || currentUserInfo == null) {
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
        if (_currentCaseData == null || currentUserInfo == null || _currentCaseData.channelId == null) {
            alert('error');
            return;
        }
        const message = messageInputRef.current?.value;
        if (message) {
            messageInputRef.current.value = '';
            await cxoneDigitalContact.reply({
                messageContent: { type: 'TEXT', payload: { text: message } },
                recipients: [],
                thread: { idOnExternalPlatform: _currentCaseData.threadIdOnExternalPlatform }
            }, _currentCaseData.channelId, uuidv4())
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

    async function updateCaseStatus(event: any) {
        console.log('updateCaseStatus', event);
        if (_currentCaseData != null) {
            const cxoneDigitalContact = new CXoneDigitalContact();
            cxoneDigitalContact.caseId = _currentCaseData.id;
            await cxoneDigitalContact.changeStatus(event.target.value);
        }
    }

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        _currentCaseData = caseData;
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
        setMessageDataList([]);
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
                {_currentCallContactData != null ? (
                    <React.Fragment>
                        <div className="chat-header">
                            <div className="profile-info">
                                <img src={defaultUserAvatar} alt="Case" className="avatar" />
                                <div>
                                    <div className="profile-info-name">{_currentCallContactData.ani}</div>
                                    <div className="message-time" data-starttime={_currentCallContactData.startTime}>00:00:00</div>
                                </div>
                            </div>
                        </div>
                        <div className="chat-messages" id="chatMessages">
                            <Call currentCallContactData={_currentCallContactData} currentVoiceContactData={_currentVoiceContactData}></Call>
                        </div>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <div className="chat-header">
                            <div className="profile-info">
                                    <img src={_currentCaseData?.authorEndUserIdentity?.image ?? defaultUserAvatar} alt="Case" className="avatar" />
                                <div>
                                    <div className="profile-info-name">{_currentCaseData?.authorEndUserIdentity?.fullName ?? 'N/A'}</div>
                                    <div className="message-time">#{_currentCaseData?.id}:{_currentCaseData?.status} {_currentCaseData?.channelId ?? 'N/A'}</div>
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
                        <div className={`chat-input ${(_currentCaseData == null || _currentCaseData.status === 'closed' ? 'chat-input-disabled' : '')}`}>
                            <div className="attachment-options">
                                <input onChange={handleFileSelect} type="file" id="fileInput" ref={fileInputRef} multiple style={{ display: 'none' }} />
                                <button onClick={() => fileInputRef?.current?.click()} className="attachment-btn">📎 File</button>

                                <button onClick={toggleRecording} className="attachment-btn" id="recordButton">{recordButtonText}</button>

                                <input onChange={handleImageSelect} type="file" id="imageInput" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} />
                                <button onClick={() => imageInputRef?.current?.click()} className="attachment-btn">🖼️ Image</button>

                                <input onChange={handleVideoSelect} type="file" id="videoInput" ref={videoInputRef} accept="video/*" style={{ display: 'none' }} />
                                <button onClick={() => videoInputRef?.current?.click()} className="attachment-btn">🎥 Video</button>

                                <select value={_currentCaseData?.status} onChange={updateCaseStatus}>
                                    {[{ id: 'new', name: 'New' }, { id: 'open', name: 'Open' }, { id: 'pending', name: 'Pending' }, { id: 'resolved', name: 'Resolved' }, { id: 'escalated', name: 'Escalated' }, { id: 'closed', name: 'Closed' }]
                                        .map((status, index) => {
                                            return (
                                                <React.Fragment key={index}>
                                                    <option disabled={(_currentCaseData?.status === 'closed' || (_currentCaseData != null && status.id === 'new'))} value={status.id}>{status.name}</option>
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