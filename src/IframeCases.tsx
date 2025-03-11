import { useEffect, useRef, useState } from "react";
import { } from "@nice-devone/acd-sdk";
import {
} from "@nice-devone/core-sdk";
import {
    CallContactEvent,
    CXoneCase,
    AgentStateEvent,
    AgentSessionResponse
} from "@nice-devone/common-sdk";
import {
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalContact
} from "@nice-devone/digital-sdk";
import { } from "@nice-devone/voice-sdk";
import { } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeCases = () => {
    const [isFirst, setIsFirst] = useState(true);
    const cxoneDigitalContact = new CXoneDigitalContact();

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

    const caseListDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('[IframeCases].useEffect[caseDataArray]...');
        if (caseListDivRef?.current) {
            caseListDivRef.current.scrollTop = 0;
        }

        if (isFirst) {
            const searchParams = new URLSearchParams(window.location.search);
            const _selectContactId = searchParams.get("selectContactId") || "";
            if (_selectContactId) {
                if (selectContactId(_selectContactId)) {
                    setIsFirst(false);
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caseDataArray, callContactDataArray]);

    useEffect(() => {
        console.log('[IframeCases].useEffect...');
        window.addEventListener('message', async function (evt) {
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

                    case 'selectCaseItem': selectCaseItem(evt.data.args); break;
                    case 'selectCallContactItem': selectCallContactItem(evt.data.args); break;
                    case 'selectContactId': selectContactId(evt.data.args); break;
                }
            }
            if (evt.data.hideCaseDetail) {
                selectCallContactItem(null);
                selectCaseItem(null);
            }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function selectContactId(contactId: string, ignoreSelectOther = false) {
        const caseData = caseDataArrayRef.current?.filter(x => x.contactId === contactId)?.at(0) ?? null;
        if (caseData) {
            selectCaseItem(caseData, ignoreSelectOther, true);
        } else {
            const callContactData = callContactDataArrayRef.current?.filter(x => x.contactId === contactId)?.at(0) ?? null;
            if (callContactData) {
                selectCallContactItem(callContactData, ignoreSelectOther, true);
            } else {
                return false;
            }
        }
        return true;
    }

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false, ignoreNotifyFocus = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        window.parent?.postMessage({ dest: 'Parent', openCaseDetail: caseData != null }, '*');
        window.parent?.postMessage({ dest: 'Parent', hideCaseDetail: caseData == null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: caseData }, '*');
        if (caseData?.id) {
            const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
            window.parent?.postMessage({ dest: 'Iframe2', command: 'handleSetMessageData', args: conversationHistory.messages }, '*');
        }
        if (caseData != null && !ignoreNotifyFocus) {
            window.parent?.postMessage({ dest: 'Parent', focusContactId: caseData.contactId }, '*');
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false, ignoreNotifyFocus = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        const voiceContactData = voiceContactDataArrayRef.current.filter(item => item.contactID === callContactData?.contactId)[0];
        window.parent?.postMessage({ dest: 'Parent', openCaseDetail: callContactData != null }, '*');
        window.parent?.postMessage({ dest: 'Parent', hideCaseDetail: callContactData == null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: callContactData }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: voiceContactData }, '*');
        if (callContactData != null && !ignoreNotifyFocus) {
            window.parent?.postMessage({ dest: 'Parent', focusContactId: callContactData.contactId }, '*');
        }
    }

    const [minusCase, setMinusCase] = useState(false);

    useEffect(() => {
        const _minusCase = localStorage.getItem('minusCase') === 'true';
        setMinusCase(_minusCase);
    }, []);

    useEffect(() => {
        if (agentSession != null && agentSession.status?.toLowerCase() !== 'SessionEnd'.toLowerCase()) {
            window.parent?.postMessage({ dest: 'Parent', minusCases: _minusCase }, '*');
        }
    }, [agentSession]);

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

    const handleMinus = () => {
        window.parent?.postMessage({ dest: 'Parent', minusCases: !minusCase }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: null }, '*');
        setMinusCase(val => {
            localStorage.setItem('minusCase', val ? 'true' : 'false');
            return !val;
        });
    }

    return (
        <div className={`app`}>
            <div ref={caseListDivRef} className="case-list">
                <span onClick={handleMinus} className="sidebar-collapse-btn"><i className={`fas fa-${minusCase ? 'plus' : 'minus'}`} style={{ fontSize: '16px', color: 'rgb(102, 102, 102)' }}></i></span>
                {/*<span id="sidebar-collapse-open" className="sidebar-collapse-btn"><i className="fas fa-bars" style={{ fontSize: '16px', color: 'rgb(102, 102, 102)' }}></i></span>*/}
                <div className="agent-profile">
                    <div className="profile-info">
                        <div>
                            <div className="profile-info-name" style={{ fontWeight: 'bold' }}>{`${callContactDataArray.length} Calls, ${caseDataArray.length} Chats`}</div>
                        </div>
                    </div>
                </div>
                {!minusCase && callContactDataArray.map((callContactData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCallContactData != null && currentCallContactData.contactId === callContactData.contactId ? 'active' : '')}`} onClick={() => selectCallContactItem(callContactData)}>
                            <div className="case-preview">
                                <img src={defaultUserAvatar} alt="" className="avatar"></img>
                                <div className="preview-details">
                                    <div>{callContactData.ani}</div>
                                    <div className="preview-message">{callContactData.status} - {callContactData.isInbound ? 'InboundCall' : 'OutboundCall'}</div>
                                    <div className="message-time" data-starttime={callContactData.startTime}>00:00:00</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
                {!minusCase && caseDataArray.map((caseData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCaseData != null && currentCaseData.id === caseData.id ? 'active' : '')}`} onClick={() => selectCaseItem(caseData)}>
                            <div className="case-preview">
                                <img src={caseData.authorEndUserIdentity?.image ?? 'N/A'} alt="" className="avatar"></img>
                                <div className={`preview-details${caseData.status.toLowerCase() === 'new' || caseData.status.toLowerCase() === 'open' ? ' item-new' : ''}`}>
                                    <div>{caseData.authorEndUserIdentity?.fullName ?? 'N/A'}</div>
                                    <div className="message-time time-auto-update-off" data-time={caseData.id}>#{caseData.id}: {`${caseData.channelId}`}</div>
                                    <div className="preview-message">{caseData.preview}</div>
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
export default IframeCases;