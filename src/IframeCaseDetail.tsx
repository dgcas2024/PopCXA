import { useEffect, useRef, useState } from "react";
/*import { v4 as uuidv4 } from 'uuid';*/
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

import './components/Call';
import ChatContainer, { ChatMessage } from './components/ChatContainer';

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


    const [messageDataArray, setMessageDataArray] = useState<Array<ChatMessage>>([]);

    useEffect(() => {
        currentUserInfoRef.current = currentUserInfo;
        currentCallContactDataRef.current = currentCallContactData;
        currentVoiceContactDataRef.current = currentVoiceContactData;
        currentCaseDataRef.current = currentCaseData;
    }, [currentCallContactData, currentCaseData, currentUserInfo, currentVoiceContactData]);

    useEffect(() => {
        const initData = function () {
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
                if (callContactData?.contactId) {
                    setCurrentCallContactData(callContactData);
                    setCurrentVoiceContactData(voiceContactData);
                }
            } catch { }
        }

        window.addEventListener('message', function (evt) {
            if (evt.data.refreshCaseDetail) {
                setMessageDataArray([]);
                initData();
            }

        })

        setMessageDataArray([]);
        initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setupAcd = async function () {
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
            console.log('[IframeCaseDetail].voiceContactUpdateEvent', voiceContactEvent);
            if (currentVoiceContactDataRef.current?.contactID === voiceContactEvent.contactID) {
                setCurrentVoiceContactData(voiceContactEvent);
                if (voiceContactEvent.status === 'Disconnected') {
                    setCurrentVoiceContactData(null);
                }
            }
        });

        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            console.log('[IframeCaseDetail].callContactEventSubject', callContactEvent);
            if (currentCallContactDataRef.current?.contactId === callContactEvent.contactId) {
                setCurrentCallContactData(callContactEvent);
                if (callContactEvent.status === 'Disconnected') {
                    setCurrentCallContactData(null);
                }
            }
        });

        const cuser = await digitalService.getDigitalUserDetails() as any;
        setCurrentUserInfo(cuser);
        console.log('[IframeCaseDetail].CurrentUser', cuser);

        const digital = async function () {
            CXoneDigitalClient.instance.initDigitalEngagement();
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                // Nothing
            });
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                console.log('[IframeCaseDetail].onDigitalContactEvent', digitalContactEvent);
                if (currentCaseDataRef.current?.id === digitalContactEvent.caseId) {
                    if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                        setCurrentCaseData(digitalContactEvent.case);
                        if (digitalContactEvent.case.status === 'closed') {
                            setCurrentCaseData(null);
                        }
                    } else {
                        if (digitalContactEvent.isCaseAssigned) {
                            setMessageDataArray([]);
                            handleSetMessageData(digitalContactEvent.messages);
                        } else {
                            setCurrentCaseData(null);
                        }
                    }
                }
            });
        }
        await digital();
    }

    useEffect(() => {
        console.log('[IframeCaseDetail].useEffect...');
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
                        if (ACDSessionManager.instance.hasSessionId) {
                            CXoneAcdClient.instance.initAcdEngagement();
                            const join_ss = await CXoneAcdClient.instance.session.joinSession();
                            console.log('[IframeCaseDetail].Join session', join_ss);
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
                if (m.authorUser.id === currentUserInfoRef.current?.user.id) {
                    avatar = currentUserInfoRef.current.user.publicImageUrl;
                }
                const messageData: ChatMessage = {
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

    const handleClose = () => {
        setCurrentCaseData(null);
        setCurrentVoiceContactData(null);
        window.parent?.postMessage({ hideCaseDetail: true }, '*');
    };

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
            <ChatContainer
                currentUserInfo={currentUserInfo}
                currentCallContactData={currentCallContactData}
                currentVoiceContactData={currentVoiceContactData}
                currentCaseData={currentCaseData}
                messageDataArray={messageDataArray}
                onClose={handleClose}
                setMessageDataArray={setMessageDataArray}
            />
        </div>
    );
};
export default IframeCaseDetail;