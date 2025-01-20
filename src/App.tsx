/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useRef, useState } from "react";
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
import { StorageKeys } from "@nice-devone/core-sdk";
import {
    AgentSessionStatus,
    AuthToken,
    EndSessionRequest,
} from "@nice-devone/common-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
    AuthWithTokenReq,
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    CXoneDigitalContact,
} from "@nice-devone/digital-sdk";
import React from "react";

const App = () => {
    const cxoneAuth = CXoneAuth.instance;
    const [authState, setAuthState] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState({} as any);

    const authSetting: AuthSettings = {
        cxoneHostname: 'https://cxone.niceincontact.com',
        clientId: '2b52d3dc-8a54-45dc-b1b8-30e780d4b303',
        redirectUri: 'https://popshe-admin.greensand-f36da917.southeastasia.azurecontainerapps.io/auth/callback',
    };

    useEffect(() => {
        cxoneAuth.onAuthStatusChange.subscribe((data) => {
            const getLastLoggedInAgentId = localStorage.getItem(StorageKeys.LAST_LOGGED_IN_AGENT_ID);
            const agentId = getLastLoggedInAgentId?.toString();
            switch (data.status) {
                case AuthStatus.AUTHENTICATING:
                    setAuthState("AUTHENTICATING");
                    break;
                case AuthStatus.AUTHENTICATED:
                    setAuthState("AUTHENTICATED");
                    setAuthToken((data.response as AuthToken).accessToken);

                    // Digital SDK consumption
                    CXoneDigitalClient.instance.initDigitalEngagement();
                    CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((eventData) => {
                        console.log("onDigitalContactNewMessageEvent", eventData);
                    });
                    CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContact) => {
                        console.log("onDigitalContactEvent", digitalContact);
                    });

                    // ACD SDK consumption
                    CXoneAcdClient.instance.initAcdEngagement();
                    CXoneAcdClient.instance.session.joinSession().then((response) => {
                        console.log("Joined Session successfully", response);
                    }).catch((err) => {
                        console.error("Join unsuccessfully", err);
                    });
                    CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: any) => {
                        setAgentStatus(agentState);
                    });
                    break;
                case AuthStatus.NOT_AUTHENTICATED:
                    setAuthState("NOT_AUTHENTICATED");
                    break;
                case AuthStatus.AUTHENTICATION_FAILED:
                    setAuthState("AUTHENTICATION_FAILED");
                    break;
                default:
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
        }

        const customerChats = [
            {
                channel: 'ZaloOA Poptech',
                name: 'Hong',
                avatar: 'https://s120-ava-talk.zadn.vn/2/7/2/2/3/120/0ffcea1d9b0a6723008791da29bda23f.jpg',
                previewLatestMessage: 'Hello, I need help with...',
                timeLatestMessage: new Date().getTime()
            },
            {
                channel: 'LineOA PopDev',
                name: 'Le Vo Thanh Hong',
                avatar: 'https://s120-ava-talk.zadn.vn/6/4/a/3/6/120/c8c733692a53cfedeff8656e77faa3f3.jpg',
                previewLatestMessage: 'Hồng ơi?',
                timeLatestMessage: new Date().getTime()
            }
        ];
        customerChats.forEach(x => addCustomerChatItem(x));
    }, []);

    //if (authState === "AUTHENTICATED") {
    //    return (
    //        <div className="app">xxx</div>
    //    )
    //}

    let isRecording = false;
    let mediaRecorder: any = null;
    let audioChunks: any = [];
    const agentName = "Poptech VietNam[HC]";
    const agentAvatar = "https://app-eu1.brandembassy.com/img/user-default.png";

    function formatDateTime(date: any) {
        if (typeof date != 'number') {
            if (typeof date == typeof '') {
                date = new Date(date);
            }
            date = date.getTime();
        }
        const now : any = new Date();
        const diffInMs = now - date;
        const diffInMinutes = Math.floor(diffInMs / 60000);

        if (diffInMinutes < 60) {
            return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
        } else if (now.toDateString() === date.toDateString()) {
            return date.toTimeString().split(' ')[0];
        } else {
            return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${date.toTimeString().split(' ')[0]}`;
        }
    }

    function messageInputKeyDown(e: any) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    function handleFileSelect(event: any) {
        const files = event.target.files;
        for (const file of files) {
            addMessage({ name: agentName, avatar: agentAvatar, time: new Date().getTime() }, `File attached: ${file.name}`, 'sent');
        }
    }

    function handleImageSelect(event: any) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                addMessage({ name: agentName, avatar: agentAvatar, time: new Date().getTime() }, 'Image sent:', 'sent', 'image', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function handleVideoSelect(event: any) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e: any) {
                addMessage({ name: agentName, avatar: agentAvatar, time: new Date().getTime() }, 'Video sent:', 'sent', 'video', e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");
    async function toggleRecording() {
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
                    addMessage({ name: agentName, avatar: agentAvatar, time: new Date().getTime() }, 'Voice message:', 'sent', 'audio', audioUrl);
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
    function addMessage(chater: any, content: string, type: string, mediaType: string | null = null, mediaUrl: string | null = null) {
        if (content !== "") {
            let media: any = null;
            if (mediaType && mediaUrl) {
                switch (mediaType) {
                    case 'image':
                        media = <div className="media-content"><img src={mediaUrl} alt=""></img></div>;
                        break;
                    case 'video':
                        <div className="media-content"><video controls={true} src={mediaUrl}></video></div>
                        break;
                    case 'audio':
                        <div className="media-content"><audio controls={true} src={mediaUrl}></audio></div>
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
        if (currentCustomerChatData == null) {
            alert('error');
            return;
        }
        const message = messageInputRef.current?.value;
        if (message) {
            addMessage({ name: agentName, avatar: agentAvatar, time: new Date().getTime() }, message, 'sent');
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
                addMessage({ name: currentCustomerChatData.name, avatar: currentCustomerChatData.avatar, time: new Date().getTime() }, randomReply, 'received');
            }, 1000 + Math.random() * 2000);
        }
    }

    const [currentCustomerChatData, setCurrentCustomerChatData] = useState<any>(null);
    function selectCustomerChatItem(customerChatData: any) {
        setMessages([]);
        setCurrentCustomerChatData(customerChatData);
    }

    const [customerChatItems, setCustomerChatItems] = useState<Array<any>>([]);
    function addCustomerChatItem(customerChatData: any) {
        const html = (
            <div className="customer-item" onClick={() => selectCustomerChatItem(customerChatData)}>
                <div className="customer-preview">
                    <img src={customerChatData.avatar} alt="" className="avatar"></img>
                    <div className="preview-details">
                        <div>{customerChatData.channel} - {customerChatData.name}</div>
                        <div className="preview-message">{customerChatData.previewLatestMessage}</div>
                        <div className="message-time time-auto-update" data-time={customerChatData.timeLatestMessage}>{formatDateTime(customerChatData.timeLatestMessage)}</div>
                    </div>
                </div>
            </div>
        )
        setCustomerChatItems(arr => {
            return [...arr, html];
        });
    }

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const _currentCustomerChatData = currentCustomerChatData ?? {
        avatar: "https://icons.iconarchive.com/icons/martz90/circle/48/video-camera-icon.png",
        name: "N/A",
        channel: "N/A"
    };

    return (
        <div className="app">
            <div className="customers-list sidebar-collapse">
                <span id="sidebar-collapse-close" className="sidebar-collapse-btn">&lt;&lt;</span>
                <span id="sidebar-collapse-open" className="sidebar-collapse-btn">&gt;&gt;</span>
                <div className="agent-profile">
                    <div className="profile-info">
                        <img src={agentAvatar} alt="Agent" className="avatar" />
                        <div>
                            <div>{agentName}</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Online: 00:30:43</div>
                        </div>
                    </div>
                    <div className="agent-status">
                        <select className="status-selector">
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                            <option value="acw">After Call Work</option>
                            <option value="busy">Busy</option>
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
                        <img src={_currentCustomerChatData.avatar} alt="Customer" className="avatar" />
                        <div>
                            <div className="profile-info-name">{_currentCustomerChatData.name}</div>
                            <div className="message-time">{_currentCustomerChatData.channel}</div>
                        </div>
                    </div>
                </div>

                <div className="chat-messages" id="chatMessages">
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