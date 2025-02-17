import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CallContactEvent, CXoneCase, } from "@nice-devone/common-sdk";
import { CXoneVoiceContact } from "@nice-devone/acd-sdk";
import Call from './Call';
import { CXoneDigitalContact } from '@nice-devone/digital-sdk';

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

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

export interface ChatMessage {
    chater: { avatar: string, name: string, time: number }, content: string, type: string, mediaType: string | null, mediaUrl: string | null
}

interface ChatContainerProps {
    currentUserInfo: any;
    currentCallContactData: CallContactEvent | null;
    currentVoiceContactData: CXoneVoiceContact | null;
    currentCaseData: CXoneCase | null;
    messageDataArray: Array<{
        chater: { avatar: string, name: string, time: number },
        content: string,
        type: string,
        mediaType: string | null,
        mediaUrl: string | null
    }>;
    onClose?: () => void;
    setMessageDataArray: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
    currentUserInfo,
    currentCallContactData,
    currentVoiceContactData,
    currentCaseData,
    messageDataArray,
    onClose,
    setMessageDataArray
}) => {
    //const regexTranslate = new RegExp('^translate:::(?<content>.+):::translate$', 's');
    const regexHtml = new RegExp('^html:::(?<content>.+):::html$', 's');
    const regexAudio = new RegExp('^audio:::(?<path>.+)$', 's');
    const regexVideo = new RegExp('^video:::(?<path>.+)$', 's');
    const regexImage = new RegExp('^image:::(?<path>.+)$', 's');

    const cxoneDigitalContact = new CXoneDigitalContact();

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);

    let isRecording = false;
    let mediaRecorder: any = null;
    let audioChunks: any = [];

    useEffect(() => {
        console.log('useEffect[messageDataList]...');
        if (messageListDivRef?.current) {
            messageListDivRef.current.scrollTop = 9999;
        }
    }, [messageDataArray]);

    function messageInputKeyDown(e: any) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    async function handleFileSelect(event: any) {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const files = event.target.files;
        for (const file of files) {
            const messageData: ChatMessage = {
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
            setMessageDataArray(arr => [...arr, messageData]);
        }
        event.target.value = '';
        //await cxoneDigitalContact.reply({
        //    messageContent: { type: 'TEXT', payload: { text: message } },
        //    recipients: [],
        //    thread: { idOnExternalPlatform: currentCaseData.threadIdOnExternalPlatform }
        //}, currentCaseData.channelId, uuidv4())
        //cxoneDigitalContact.upload({
        //    content: '',
        //    mimeType: '',
        //}, '')
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
                setMessageDataArray(arr => [...arr, messageData]);
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
                setMessageDataArray(arr => [...arr, messageData]);
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
        if (currentCaseData == null || currentUserInfo == null || currentCaseData.channelId == null) {
            alert('error');
            return;
        }
        const message = messageInputRef?.current?.value;
        if (message) {
            messageInputRef.current.value = '';
            await cxoneDigitalContact.reply({
                messageContent: { type: 'TEXT', payload: { text: message } },
                recipients: [],
                thread: { idOnExternalPlatform: currentCaseData.threadIdOnExternalPlatform }
            }, currentCaseData.channelId, uuidv4())
        }
    }

    async function updateCaseStatus(event: any) {
        console.log('updateCaseStatus', event);
        if (currentCaseData != null) {
            const cxoneDigitalContact = new CXoneDigitalContact();
            cxoneDigitalContact.caseId = currentCaseData.id;
            await cxoneDigitalContact.changeStatus(event.target.value);
        }
    }


    return (
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
                        {onClose && (
                            <button 
                                onClick={onClose}
                                style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    transition: 'background-color 0.2s',
                                    zIndex: 1000
                                }}
                            >
                                <i className="fas fa-times" style={{fontSize: '16px', color: '#666'}}></i>
                            </button>
                        )}
                    </div>
                    <div ref={messageListDivRef} className="chat-messages" id="chatMessages">
                        {messageDataArray.filter(messageData => (messageData.content ?? '') !== '' || true).map((messageData, index) => {
                            if (regexHtml.test(messageData.content)) {
                                messageData.mediaUrl = (regexHtml.exec(messageData.content)?.groups ?? {})['content'];
                                messageData.mediaType = 'html';
                            }
                            if (regexImage.test(messageData.content)) {
                                messageData.mediaUrl = `${process.env.REACT_APP__POPSHE_URL?.replace(/\/+$/, '')}/${(regexImage.exec(messageData.content)?.groups ?? {})['path']}`;
                                messageData.content = '';
                                messageData.mediaType = 'image';
                            }
                            if (regexVideo.test(messageData.content)) {
                                messageData.mediaUrl = `${process.env.REACT_APP__POPSHE_URL?.replace(/\/+$/, '')}/${(regexVideo.exec(messageData.content)?.groups ?? {})['path']}`;
                                messageData.content = '';
                                messageData.mediaType = 'video';
                            }
                            if (regexAudio.test(messageData.content)) {
                                messageData.mediaUrl = `${process.env.REACT_APP__POPSHE_URL?.replace(/\/+$/, '')}/${(regexAudio.exec(messageData.content)?.groups ?? {})['path']}`;
                                messageData.content = '';
                                messageData.mediaType = 'audio';
                            }
                            let media: any = null;
                            let content: any = messageData.content;
                            if (messageData.mediaType && messageData.mediaUrl) {
                                switch (messageData.mediaType) {
                                    case 'image':
                                        media = <div className="media-content"><img src={messageData.mediaUrl} alt="IMG"></img></div>;
                                        break;
                                    case 'video':
                                        media = <div className="media-content"><video controls={true}><source src={messageData.mediaUrl} />Not support video message</video></div>
                                        break;
                                    case 'audio':
                                        media = <div className="media-content"><audio controls={true}><source src={messageData.mediaUrl} />Not support audio message</audio></div>
                                        break;
                                    case 'html':
                                        media = <div dangerouslySetInnerHTML={{ __html: messageData.mediaUrl }}></div>
                                        content = '';
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
                                            {content}
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
    );
};

export default ChatContainer; 