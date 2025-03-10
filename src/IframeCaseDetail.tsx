import { useEffect, useRef, useState } from "react";
/*import { v4 as uuidv4 } from 'uuid';*/
import { } from "@nice-devone/acd-sdk";
import {
} from "@nice-devone/core-sdk";
import {
    CallContactEvent,
    CXoneMessageArray,
    CXoneCase,
    AgentStateEvent,
    AgentSessionResponse
} from "@nice-devone/common-sdk";
import {
} from "@nice-devone/auth-sdk";
import {
} from "@nice-devone/digital-sdk";
import {  } from "@nice-devone/voice-sdk";
import { } from "@nice-devone/agent-sdk";

import './components/Call';
import ChatContainer, { ChatMessage } from './components/ChatContainer';

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeCaseDetail = () => {
    const [messageDataArray, setMessageDataArray] = useState<Array<ChatMessage>>([]);

    const [authToken, ] = useState("");
    const [agentStatus, ] = useState<AgentStateEvent>({} as AgentStateEvent);
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
    const agentLegIdRef = useRef(agentLegId);

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
        agentLegIdRef.current = agentLegId;
    }, [currentCallContactData, currentUserInfo, currentVoiceContactData, currentCaseData, agentSession, authState, caseDataArray, voiceContactDataArray, callContactDataArray, authToken, agentStatus, agentLegId]);

    useEffect(() => {
        window.parent?.postMessage({ dest: 'Iframe2', command: 'askState' }, '*');
    }, [])

    useEffect(() => {
        voiceContactDataArrayRef.current = voiceContactDataArray;
        currentUserInfoRef.current = currentUserInfo;
    }, [voiceContactDataArray, currentUserInfo])

    useEffect(() => {
        window.addEventListener('message', function (evt) {
            if (evt.data.dest === 'Iframe2') {
                switch (evt.data.command) {
                    case 'setCaseDataArray': setCaseDataArray(evt.data.args); break;
                    case 'setAgentSession': setAgentSession(evt.data.args); break;
                    case 'setAuthState': setAuthState(evt.data.args); break;
                    case 'setCallContactDataArray': setCallContactDataArray(evt.data.args); break;
                    case 'setVoiceContactDataArray': setVoiceContactDataArray(evt.data.args); break;
                    case 'setCurrentUserInfo': setCurrentUserInfo(evt.data.args); break;
                    case 'setCurrentVoiceContactData': setCurrentVoiceContactData(evt.data.args); break;
                    case 'setCurrentCaseData': setCurrentCaseData(evt.data.args); break;
                    case 'setCurrentCallContactData': setCurrentCallContactData(evt.data.args); break;
                    case 'setAgentLegId': setAgentLegId(evt.data.args); break;

                    case 'handleSetMessageData': handleSetMessageData(evt.data.args); break;
                }
            }
        })
        setMessageDataArray([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSetMessageData(messages: CXoneMessageArray) {
        const messageArray = messages.map(m => {
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
                return messageData;
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
                return messageData;
            }
        });
        setMessageDataArray(messageArray);
    }

    const handleClose = () => {
        window.parent?.postMessage({ dest: 'Parent', hideCaseDetail: true }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: null }, '*');
    };

    if (authState !== "AUTHENTICATED") {
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: '#fff' }}>
                    <h4>{authState || 'N/A'}</h4>
                </div>
            </div>
        )
    }

    if (!agentSession || agentSession.status?.toLowerCase() === 'SessionEnd'.toLowerCase()) {
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', background: '#fff' }}>
                    <h4>SESSION NOT STARTED YET</h4>
                </div>
            </div>
        )
    }

    const connectAgentLeg = (agentLegId: string) => {
        window.parent?.postMessage({ dest: 'Iframe2', command: 'connectAgentLeg', args: agentLegId }, '*');
    }

    return (
        <div className={`app`}>
            <ChatContainer
                connectAgentLeg={connectAgentLeg}
                agentLegId={agentLegId}
                currentUserInfo={currentUserInfo}
                currentCallContactData={currentCallContactData}
                currentVoiceContactData={currentVoiceContactData}
                currentCaseData={currentCaseData}
                messageDataArray={messageDataArray}
                onClose={handleClose}
            />
        </div>
    );
};
export default IframeCaseDetail;