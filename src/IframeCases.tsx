import { useEffect, useRef, useState } from "react";
import { CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
} from "@nice-devone/core-sdk";
import {
    CallContactEvent,
    CXoneCase,
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
    const cxoneDigitalContact = new CXoneDigitalContact();

    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const currentUserInfoRef = useRef(currentUserInfo);

    const [agentSession, setAgentSession] = useState<any>();
    const [authState, setAuthState] = useState("");

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);
    const voiceContactDataArrayRef = useRef(voiceContactDataArray);
    const [, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);

    const [caseDataArray, setCaseDataArray] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);

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
    }, [caseDataArray]);

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

                    case 'selectCaseItem': selectCaseItem(evt.data.args); break;
                }
            }
            if (evt.data.hideCaseDetail) {
                selectCallContactItem(null);
                selectCaseItem(null);
            }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        window.parent?.postMessage({ dest: 'Parent', openCaseDetail: caseData != null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: caseData }, '*');
        if (caseData?.id) {
            const conversationHistory = await cxoneDigitalContact.loadConversationHistory(caseData.id);
            window.parent?.postMessage({ dest: 'Iframe2', command: 'handleSetMessageData', args: conversationHistory.messages }, '*');
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        const voiceContactData = voiceContactDataArrayRef.current.filter(item => item.contactID === callContactData?.contactId)[0];
        window.parent?.postMessage({ dest: 'Parent', openCaseDetail: callContactData != null }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: callContactData }, '*');
        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: voiceContactData }, '*');
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

    if (!agentSession) {
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
            <div ref={caseListDivRef} className="case-list">
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
        </div>
    );
};
export default IframeCases;