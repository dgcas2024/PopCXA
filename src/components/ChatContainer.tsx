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
}

let isRecording = false;
let mediaRecorder: any = null;
let audioChunks: any = [];

const ChatContainer: React.FC<ChatContainerProps> = ({
    currentUserInfo,
    currentCallContactData,
    currentVoiceContactData,
    currentCaseData,
    messageDataArray,
    onClose
}) => {
    //const regexTranslate = new RegExp('^translate:::(?<content>.+):::translate$', 's');
    const regexHtml = new RegExp('^html:::(?<content>.+):::html$', 's');
    const regexAudio = new RegExp('^audio:::(?<path>.+)$', 's');
    const regexVideo = new RegExp('^video:::(?<path>.+)$', 's');
    const regexImage = new RegExp('^image:::(?<path>.+)$', 's');

    const regexSticker_Line = new RegExp('^line-sticker:::(?<id>[0-9]+):(?<pid>[0-9]+)$', 's');

    const cxoneDigitalContact = new CXoneDigitalContact();

    const [recordButtonText, setRecordButtonText] = useState("🎤 Record");
    const fileInputRef = useRef<HTMLInputElement>(null);
    //const imageInputRef = useRef<HTMLInputElement>(null);
    //const videoInputRef = useRef<HTMLInputElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null);

    const messageListDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('[ChatContainer].useEffect[messageDataList]...');
        if (messageListDivRef?.current) {
            messageListDivRef.current.lastElementChild?.scrollIntoView();
            setTimeout(() => {
                messageListDivRef?.current?.lastElementChild?.scrollIntoView();
            }, 1000);
        }
    }, [messageDataArray]);

    const lockManager = function () {
        const _lockQueue: Array<any> = [];
        let _isLocked = false;

        const lockAsync = async function () {
            return new Promise((resolve: any) => {
                if (!_isLocked) {
                    _isLocked = true;
                    resolve();
                } else {
                    _lockQueue.push(resolve);
                }
            });
        };

        const release = function () {
            if (_lockQueue.length > 0) {
                const resolve = _lockQueue.shift();
                resolve();
            } else {
                _isLocked = false;
            }
        };

        return {
            executeAsync: async function (executor: any) {
                await lockAsync();
                try {
                    return await executor();
                } finally {
                    release();
                }
            }
        };
    };

    const publicApiAuth = function () {
        const lock1 = lockManager();
        const lock2 = lockManager();
        const publicApi = `${process.env.REACT_APP__POPSHE_URL}@${process.env.REACT_APP__POPSHE_CREDENTIAL}`;
        const clientId = publicApi.split('@')[1];
        const clientSecret = publicApi.split('@')[2];
        let baseUrl = publicApi.split('@')[0];
        baseUrl = baseUrl.replace(/\/+$/, '');
        let _auth = {
            get token() { return JSON.parse(localStorage.getItem('popshe-api-auth-token') || '{}'); },
            set token(val: any) {
                if (val) {
                    val.concurrencyStamp = uuidv4();
                    localStorage.setItem('popshe-api-auth-token', JSON.stringify(val));
                } else {
                    localStorage.removeItem('popshe-api-auth-token');
                }
            },

            get message() { return localStorage.getItem('popshe-api-auth-message'); },
            set message(val) { localStorage.setItem('popshe-api-auth-message', val ?? '') },

            get baseUrl() { return baseUrl },

            clear: function () {
                this.token = null;
                this.message = null;
            },
            requestTokenAsync: async function () {
                let currentToken = this.token;
                let currentStamp = currentToken?.concurrencyStamp
                return await lock1.executeAsync(async () => {
                    try {
                        let _currentToken = this.token;
                        let _currentStamp = _currentToken?.concurrencyStamp
                        if (_currentToken?.access_token != null && _currentStamp !== currentStamp) {
                            return true;
                        }
                        console.log("[ChatContainer].Request token...");
                        this.clear();
                        const rs = await fetch(`${baseUrl}/api/auth/invoke`, {
                            method: 'POST',
                            headers: {
                                'skip_zrok_interstitial': 'true',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                grant_type: 'client_credentials',
                                client_id: clientId,
                                client_secret: clientSecret
                            })
                        });
                        const json = await rs.json();
                        if (json.success) {
                            json.expires_at = new Date(new Date().getTime() + json.expires_in * 1000);
                            this.token = json;
                            console.log("[ChatContainer].Request token done.");
                            return true;
                        }
                        this.message = json.message;
                    } catch (e: any) {
                        this.message = (typeof e) === typeof '' ? e as string : JSON.stringify(e);
                    }
                    console.error("Request token fail", this.message);
                    return false;
                });
            },

            refreshTokenAsync: async function () {
                let currentToken = this.token;
                let currentStamp = currentToken?.concurrencyStamp
                return await lock1.executeAsync(async () => {
                    try {
                        let _currentToken = this.token;
                        let _currentStamp = _currentToken?.concurrencyStamp
                        if (_currentToken?.access_token != null && _currentStamp !== currentStamp) {
                            return true;
                        }
                        console.log("[ChatContainer].Refresh token...");
                        const refresh_token = this.token.refresh_token;
                        const access_token = this.token.access_token;
                        this.clear();
                        const rs = await fetch(`${baseUrl}/api/auth/refresh`, {
                            method: 'POST',
                            headers: {
                                'skip_zrok_interstitial': 'true',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                access_token: access_token,
                                refresh_token: refresh_token
                            })
                        });
                        const json = await rs.json();
                        if (json.success) {
                            json.expires_at = new Date(new Date().getTime() + json.expires_in * 1000);
                            this.token = json;
                            console.log("[ChatContainer].Refresh token done.");
                            return true;
                        }
                        this.message = json.message;
                    } catch (e: any) {
                        this.message = (typeof e) === typeof '' ? e as string : JSON.stringify(e);
                    }
                    console.warn("[ChatContainer].Refresh token fail", this.message)
                    return false;
                });
            },

            refreshOrRequestTokenAsync: async function () {
                let currentToken = this.token;
                let currentStamp = currentToken?.concurrencyStamp
                return lock2.executeAsync(async () => {
                    let _currentToken = this.token;
                    let _currentStamp = _currentToken?.concurrencyStamp
                    if (_currentToken?.access_token != null && _currentStamp !== currentStamp) {
                        return true;
                    }
                    if (this.token?.refresh_token && await this.refreshTokenAsync()) {
                        return true;
                    }
                    return await this.requestTokenAsync();
                });
            },

            sendRequestAsync: async function (resource: string, requestBuilder: (request: any) => void, tryCount: number): Promise<Response> {
                const request: any = {
                    headers: { skip_zrok_interstitial: true }
                };
                requestBuilder(request);
                if ((!this.token?.expires_at || (new Date().getTime() - new Date(this.token.expires_at as number).getTime()) > -30000) && !await this.refreshOrRequestTokenAsync()) {
                    throw new Error(`sendRequestAsync fail: ${baseUrl}/${resource}`);
                }
                request.headers['Authorization'] = `${this.token.token_type} ${this.token.access_token}`
                const rs = await fetch(`${baseUrl}/${resource.replace(/^\/+/, '')}`, request);
                if (rs.status === 401 && tryCount > 0) {
                    var token = JSON.parse(JSON.stringify(this.token));
                    token.expires_at = new Date();
                    this.token = token;
                    return await this.sendRequestAsync(resource, requestBuilder, tryCount - 1);
                }
                return rs;
            }
        }
        return _auth;
    }();
    const durationAsync = async function (file: File): Promise<number> {
        if (!file.type.startsWith('audio') && !file.type.startsWith('video')) {
            throw new Error(`Media type invalid: ${file.type}`);
        }
        return await new Promise((rs, rj) => {
            const media = document.createElement(file.type.startsWith('audio') ? 'audio' : 'video');
            let done = false;
            setTimeout(function () {
                if (!done) {
                    URL.revokeObjectURL(media.src);
                    done = true;
                    rj('timeout');
                }
            }, 15000);
            media.addEventListener('loadedmetadata', async function () {
                if (!done) {
                    var duration = media.duration * 1000;
                    URL.revokeObjectURL(media.src);
                    done = true;
                    rs(duration);
                }
            });
            media.src = URL.createObjectURL(file);
        });
    }
    const thumbnailAsync = async function (file: File): Promise<Blob>{
        if (!file.type.startsWith('video') && !file.type.startsWith('image')) {
            throw new Error(`Media type invalid: ${file.type}`);
        }
        return await new Promise((rs, rj) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const media = document.createElement(file.type.startsWith('video') ? 'video' : 'img');
            if (file.type.startsWith('video')) {
                (media as HTMLVideoElement).autoplay = true;
                (media as HTMLVideoElement).muted = true;
            }
            let done = false;
            canvas.style.display = 'none';
            media.style.display = 'none';
            document.body.appendChild(canvas);
            document.body.appendChild(media);
            setTimeout(function () {
                if (!done) {
                    URL.revokeObjectURL(media.src);
                    media.remove();
                    canvas.remove();
                    done = true;
                    rj('timeout');
                }
            }, 15000);
            media.addEventListener(file.type.startsWith('video') ? 'loadeddata' : 'load', async function () {
                if (!done) {
                    let w = media.width;
                    let h = media.height;
                    if (file.type.startsWith('video')) {
                        w = (media as HTMLVideoElement).videoWidth;
                        h = (media as HTMLVideoElement).videoHeight;
                    }
                    const rt = w / 450;
                    w = 450;
                    h = h / rt;
                    canvas.width = w;
                    canvas.height = h;
                    context?.drawImage(media, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(media.src);
                    media.remove();
                    canvas.toBlob(function (blob) {
                        canvas.remove();
                        done = true;
                        blob && rs(blob);
                    }, 'image/jpeg');
                }
            });
            media.src = URL.createObjectURL(file);
            if (file.type.startsWith('video')) {
                (media as HTMLVideoElement).load();
            }
        });
    }
    const blob2Base64Async = async function (blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                resolve(base64String as string);
            };
            reader.onerror = error => reject(error);
            reader.readAsDataURL(blob);
        });
    }

    function messageInputKeyDown(e: any) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }

    async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
        if (currentCaseData == null || currentUserInfo == null) {
            alert('error');
            return;
        }
        const use_cxone_storage = await publicApiAuth.sendRequestAsync('/api/file/storage-type', function (request) { request.method = 'GET'; }, 1);
        const use_cxone_storage_json = await use_cxone_storage.json();
        const files = event.target.files;
        for (let i = 0; i < (files?.length ?? 0); i++) {
            const file = files?.item(i);
            if (file) {
                let duration: number | null = null;
                let thumbnailId: string | null = null;
                if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
                    duration = await durationAsync(file);
                }
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    const thumbnailBlob = await thumbnailAsync(file);
                    const thumbnailFileName = `${uuidv4().replaceAll('-', '')}.jpeg`;
                    const thumbnailFromData = new FormData();
                    if (use_cxone_storage_json.code === 1) {
                        const thumbnailUpload = await cxoneDigitalContact.upload({
                            content: (await blob2Base64Async(thumbnailBlob)).split(',')[1],
                            mimeType: thumbnailBlob.type
                        }, uuidv4());
                        thumbnailFromData.append('url', thumbnailUpload.url);
                    } else {
                        thumbnailFromData.append('file', thumbnailBlob, thumbnailFileName);
                    }
                    const thumbnailUpload2 = await publicApiAuth.sendRequestAsync('/api/file/upload', function (request) {
                        request.method = 'POST';
                        request.body = thumbnailFromData;
                        request.headers['FileName'] = encodeURIComponent(thumbnailFileName);
                        request.headers['ContentType'] = thumbnailBlob.type;
                        request.headers['ContentLength'] = thumbnailBlob.size;
                    }, 1);
                    const thumbnailUpload2_Json = await thumbnailUpload2.json();
                    thumbnailId = thumbnailUpload2_Json.id;
                }
                const filemainFormData = new FormData();
                if (use_cxone_storage_json.code === 1) {
                    const filemainUpload = await cxoneDigitalContact.upload({
                        content: (await blob2Base64Async(file)).split(',')[1],
                        mimeType: file.type
                    }, uuidv4());
                    filemainFormData.append('url', filemainUpload.url);
                } else {
                    filemainFormData.append('file', file);
                }
                
                const filemainUpload2 = await publicApiAuth.sendRequestAsync('/api/file/upload', function (request) {
                    request.method = 'POST';
                    request.body = filemainFormData;
                    request.headers['FileName'] = encodeURIComponent(file.name);
                    request.headers['ContentType'] = file.type;
                    request.headers['ContentLength'] = file.size;
                    if (duration != null) {
                        request.headers['Duration'] = duration;
                    }
                    if (thumbnailId != null) {
                        request.headers['ThumbnailId'] = thumbnailId;
                    }
                }, 1);
                const filemainUpload2_Json = await filemainUpload2.json();
                console.log('[ChatContainer].File upload', filemainUpload2_Json);
                let text = `File download`;
                let attachments = [];
                if ((filemainUpload2_Json.contentType ?? '').startsWith('image/')) {
                    text = `image:::api/file/download/${filemainUpload2_Json.id}`;
                } else if ((filemainUpload2_Json.contentType ?? '').startsWith('audio/')) {
                    text = `audio:::api/file/download/${filemainUpload2_Json.id}`;
                } else if ((filemainUpload2_Json.contentType ?? '').startsWith('video/')) {
                    text = `video:::api/file/download/${filemainUpload2_Json.id}`;
                }
                else {
                    attachments.push({
                        id: filemainUpload2_Json.id,
                        friendlyName: filemainUpload2_Json.fileName,
                        url: `${publicApiAuth.baseUrl}/api/file/download/${filemainUpload2_Json.id}`
                    });
                }
                await cxoneDigitalContact.reply({
                    messageContent: { type: 'TEXT', payload: { text: text } },
                    recipients: [],
                    thread: { idOnExternalPlatform: currentCaseData.threadIdOnExternalPlatform },
                    attachments: attachments
                }, currentCaseData.channelId, uuidv4())
            }
        }
        event.target.value = '';
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

                let start = performance.now();

                mediaRecorder.ondataavailable = (event: any) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    if (start === -1) {
                        return;
                    }
                    const use_cxone_storage = await publicApiAuth.sendRequestAsync('/api/file/storage-type', function (request) { request.method = 'GET'; }, 1);
                    const use_cxone_storage_json = await use_cxone_storage.json();
                    const duration = performance.now() - start;
                    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                    const audioFileName = `${uuidv4().replaceAll('-', '')}.wav`;
                    const audioFormData = new FormData();
                    if (use_cxone_storage_json.code === 1) {
                        const audioUpload = await cxoneDigitalContact.upload({
                            content: (await blob2Base64Async(audioBlob)).split(',')[1],
                            mimeType: audioBlob.type
                        }, uuidv4());
                        audioFormData.append('url', audioUpload.url);
                    } else {
                        audioFormData.append('file', audioBlob, audioFileName);
                    }
                    const audioUpload2 = await publicApiAuth.sendRequestAsync('/api/file/upload', function (request) {
                        request.method = 'POST';
                        request.body = audioFormData;
                        request.headers['FileName'] = encodeURIComponent(audioFileName);
                        request.headers['ContentType'] = audioBlob.type;
                        request.headers['ContentLength'] = audioBlob.size;
                        request.headers['Duration'] = duration;
                    }, 1);
                    const audioUpload2_Json = await audioUpload2.json();
                    console.log('[ChatContainer].Voice record', audioUpload2_Json);
                    const text = `audio:::api/file/download/${audioUpload2_Json.id}`;
                    await cxoneDigitalContact.reply({
                        messageContent: { type: 'TEXT', payload: { text: text } },
                        recipients: [],
                        thread: { idOnExternalPlatform: currentCaseData.threadIdOnExternalPlatform }
                    }, currentCaseData.channelId, uuidv4())
                };

                mediaRecorder.start();
                isRecording = true;
                setRecordButtonText("⏹️ Stop");
            } catch (err) {
                console.error('[ChatContainer].Error accessing microphone:', err);
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
        console.log('[ChatContainer].updateCaseStatus', event);
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
                            if (regexSticker_Line.test(messageData.content)) {
                                messageData.mediaUrl = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${(regexSticker_Line.exec(messageData.content)?.groups ?? {})['id']}/android/sticker.png`;
                                messageData.mediaUrl = `<img style="max-width:80px;" src="${messageData.mediaUrl}" alt="IMG"></img>`
                                messageData.content = '';
                                messageData.mediaType = 'html';
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
                                        media = <div className="media-content" dangerouslySetInnerHTML={{ __html: messageData.mediaUrl }}></div>
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
                            <button onClick={() => {
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                                fileInputRef.current?.click();
                            }} className="attachment-btn">📎 File</button>

                            <button onClick={toggleRecording} className="attachment-btn" id="recordButton">{recordButtonText}</button>

                            {/*<input onChange={handleImageSelect} type="file" id="imageInput" ref={imageInputRef} accept="image/*" style={{ display: 'none' }} />*/}
                            {/*<button onClick={() => imageInputRef?.current?.click()} className="attachment-btn">🖼️ Image</button>*/}

                            {/*<input onChange={handleVideoSelect} type="file" id="videoInput" ref={videoInputRef} accept="video/*" style={{ display: 'none' }} />*/}
                            {/*<button onClick={() => videoInputRef?.current?.click()} className="attachment-btn">🎥 Video</button>*/}

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