import { useEffect, useRef, useState } from "react";
import { CXoneAcdClient, CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    SortingType,
    CallContactEvent,
    CXoneCase,
} from "@nice-devone/common-sdk";
import {
    CXoneAuth,
    AuthStatus,
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    DigitalService,
} from "@nice-devone/digital-sdk";
import { } from "@nice-devone/voice-sdk";
import { } from "@nice-devone/agent-sdk";
import React from "react";

import './components/Call';

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const delay = (ms: number) => new Promise(rs => {
    setTimeout(rs, ms);
})

const IframeCases = () => {
    const cxoneAuth = CXoneAuth.instance;
    const digitalService = new DigitalService();

    const [authState, setAuthState] = useState("");
    const [, setAuthToken] = useState("");

    const [, setCurrentUserInfo] = useState<any>();

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);
    const currentCallContactDataRef = useRef(currentCallContactData);

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);
    const voiceContactDataArrayRef = useRef(voiceContactDataArray);
    const [currentVoiceContactData, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);
    const currentVoiceContactDataRef = useRef(currentVoiceContactData);

    const [caseDataArray, setCaseDataArray] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);
    const currentCaseDataRef = useRef(currentCaseData);

    useEffect(() => {
        currentCallContactDataRef.current = currentCallContactData;
        voiceContactDataArrayRef.current = voiceContactDataArray;
        currentVoiceContactDataRef.current = currentVoiceContactData;
        currentCaseDataRef.current = currentCaseData;
    }, [currentCallContactData, currentCaseData, currentVoiceContactData, voiceContactDataArray])

    const caseListDivRef = useRef<HTMLDivElement>(null);

    const setupAcd = async () => {
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
            console.log("voiceContactUpdateEvent", voiceContactEvent);
            if (currentVoiceContactDataRef.current?.contactID === voiceContactEvent.contactID) {
                setCurrentVoiceContactData(voiceContactEvent);
                if (voiceContactEvent.status === 'Disconnected') {
                    setCurrentVoiceContactData(null);
                    localStorage.removeItem('currentVoiceContactData');
                    window.parent?.postMessage({ hideCaseDetail: true }, '*');
                }
            }
            setVoiceContactDataArray(arr => arr.filter(item => item.contactID !== voiceContactEvent.contactID));
            if (voiceContactEvent.status !== 'Disconnected') {
                setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
            }
        });

        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            console.log("callContactEvent", callContactEvent);
            if (currentCallContactDataRef.current?.contactId === callContactEvent.contactId) {
                setCurrentCallContactData(callContactEvent);
                if (callContactEvent.status === 'Disconnected') {
                    setCurrentCallContactData(null);
                    localStorage.removeItem('currentCallContactData');
                    window.parent?.postMessage({ hideCaseDetail: true }, '*');
                }
            }
            setCallContactDataArray(arr => arr.filter(item => item.contactId !== callContactEvent.contactId));
            if (callContactEvent.status !== 'Disconnected') {
                setCallContactDataArray(arr => [...arr, callContactEvent]);
            }
        });

        const cuser = await digitalService.getDigitalUserDetails() as any;
        setCurrentUserInfo(cuser);
        console.log(cuser);

        const digital = async function () {
            const refreshCaseArray = async function (_delay: number | null) {
                if (_delay != null) {
                    await delay(_delay);
                }
                const rs = await digitalService.getDigitalContactSearchResult({
                    sortingType: SortingType.DESCENDING,
                    sorting: 'createdAt',
                    inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
                    status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
                }, true, true);
                console.log('Case data array', rs);
                setCaseDataArray([]);
                (rs.data as Array<any>).reverse().forEach(c => setCaseDataArray(arr => [c, ...arr]));
            }
            // Digital SDK consumption
            CXoneDigitalClient.instance.initDigitalEngagement();
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
            });
            CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                console.log("onDigitalContactEvent", digitalContactEvent);
                refreshCaseArray(1000);
                if (currentCaseDataRef.current?.id === digitalContactEvent.caseId) {
                    if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                        setCurrentCaseData(digitalContactEvent.case);
                        if (digitalContactEvent.case.status === 'closed') {
                            selectCaseItem(null);
                            localStorage.removeItem('currentCaseData');
                            window.parent?.postMessage({ hideCaseDetail: true }, '*');
                        }
                    } else {
                        if (digitalContactEvent.isCaseAssigned) {
                            // Nothing
                        } else {
                            selectCaseItem(null);
                            localStorage.removeItem('currentCaseData');
                            window.parent?.postMessage({ hideCaseDetail: true }, '*');
                        }
                    }
                }
            });
            await refreshCaseArray(null);
        }
        digital();
    }

    useEffect(() => {
        console.log('useEffect[caseDataArray]...');
        if (caseListDivRef?.current) {
            caseListDivRef.current.scrollTop = 0;
        }
    }, [caseDataArray]);

    useEffect(() => {
        window.addEventListener('message', function (evt) {
            if (evt.data.hideCaseDetail) {
                selectCallContactItem(null);
                selectCaseItem(null);
            }
            if (evt.data.sessionStarted === true) {
                setCaseDataArray(arr => arr);
            }
            if (evt.data.sessionEnded === true) {
                setCaseDataArray([]);
            }
        })
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
                        if (ACDSessionManager.instance.hasSessionId) {
                            CXoneAcdClient.instance.initAcdEngagement();
                            const join_ss = await CXoneAcdClient.instance.session.joinSession();
                            console.log('[0]. Join session', join_ss);
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

    async function selectCaseItem(caseData: CXoneCase | null, ignoreSelectCallContactItem = false) {
        if (!ignoreSelectCallContactItem) {
            selectCallContactItem(null, true);
        }
        setCurrentCaseData(caseData);
        if (caseData != null) {
            try {
                localStorage.setItem('currentCaseData', JSON.stringify(caseData));
                localStorage.removeItem('currentCallContactData');
                localStorage.removeItem('currentVoiceContactData');
            } catch { }
            window.parent?.postMessage({ openCaseDetail: true }, '*');
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        setCurrentCallContactData(callContactData);
        const voiceContactData = voiceContactDataArrayRef.current.filter(item => item.contactID === callContactData?.contactId)[0];
        setCurrentVoiceContactData(voiceContactData);

        if (callContactData != null) {
            try {
                localStorage.removeItem('currentCaseData');
                localStorage.setItem('currentCallContactData', JSON.stringify(callContactData));
                localStorage.setItem('currentVoiceContactData', JSON.stringify(voiceContactData));
            } catch { }
            window.parent?.postMessage({ openCaseDetail: true }, '*');
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