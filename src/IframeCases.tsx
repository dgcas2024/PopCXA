﻿import { useEffect, useRef, useState } from "react";
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
    AuthSettings,
    AuthWithCodeReq,
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

let _currentCaseData: any = null;
let _currentCallContactData: CallContactEvent | null = null;
let _currentVoiceContactData: CXoneVoiceContact | null = null;

const authSetting: AuthSettings = {
    cxoneHostname: process.env.REACT_APP__CXONE_HOST_NAME || '',
    clientId: process.env.REACT_APP__CXONE_CLIENT_ID || '',
    redirectUri: process.env.REACT_APP__CXONE_AUTH_REDIRECT_URL || '',
};

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeCases = () => {
    const cxoneAuth = CXoneAuth.instance;
    const digitalService = new DigitalService();

    const [authState, setAuthState] = useState("");
    const [, setAuthToken] = useState("");

    const [, setCurrentUserInfo] = useState<any>();

    const [callContactDataArray, setCallContactDataArray] = useState<Array<CallContactEvent>>([]);
    const [currentCallContactData, setCurrentCallContactData] = useState<CallContactEvent | null>(null);

    const [voiceContactDataArray, setVoiceContactDataArray] = useState<Array<CXoneVoiceContact>>([]);
    const [, setCurrentVoiceContactData] = useState<CXoneVoiceContact | null>(null);
    
    const [caseDataList, setCaseDataList] = useState<Array<any>>([]);
    const [currentCaseData, setCurrentCaseData] = useState<CXoneCase | null>(null);

    const caseListDivRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (caseListDivRef?.current) {
            caseListDivRef.current.scrollTop = 0;
        }
    }, [caseDataList]);

    useEffect(() => {
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
                            await CXoneAcdClient.instance.session.joinSession();

                            CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: CXoneVoiceContact) => {
                                console.log("voiceContactUpdateEvent", voiceContactEvent);
                                if (_currentVoiceContactData?.interactionId === voiceContactEvent.interactionId) {
                                    setCurrentVoiceContactData(voiceContactEvent);
                                }
                                setVoiceContactDataArray(voiceContactDataArray.filter(item => item.interactionId !== voiceContactEvent.interactionId));
                                if (voiceContactEvent.status !== 'Disconnected') {
                                    setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
                                } else {
                                    setCurrentVoiceContactData(null);
                                }
                            });

                            ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
                                console.log("callContactEvent", callContactEvent);
                                if (_currentCallContactData?.interactionId === callContactEvent.interactionId) {
                                    setCurrentCallContactData(callContactEvent);
                                }
                                setCallContactDataArray(callContactDataArray.filter(item => item.interactionId !== callContactEvent.interactionId));
                                if (callContactEvent.status !== 'Disconnected') {
                                    setCallContactDataArray(arr => [...arr, callContactEvent]);
                                } else {
                                    setCurrentCallContactData(null);
                                }
                            });
                        } else {
                            return false;
                        }
                        return true;
                    }
                    if (!acd()) {
                        break;
                    }

                    const user = async function () {
                        const me = await digitalService.getDigitalUserDetails() as any;
                        setCurrentUserInfo(me);
                        console.log('Me', me);
                        return me;
                    }
                    const userTask = user();

                    const digital = async function () {
                        const cuser = await userTask;
                        console.log(cuser)
                        const refreshCaseList = async function () {
                            const _caseDataList = await digitalService.getDigitalContactSearchResult({
                                sortingType: SortingType.DESCENDING,
                                sorting: 'createdAt',
                                inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
                                status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
                            }, true, true);
                            console.log('Case data list', _caseDataList);
                            setCaseDataList([]);
                            (_caseDataList.data as Array<any>).reverse().forEach(c => setCaseDataList(arr => [c, ...arr]));
                        }
                        // Digital SDK consumption
                        CXoneDigitalClient.instance.initDigitalEngagement();
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
                            console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
                        });
                        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
                            console.log("onDigitalContactEvent", digitalContactEvent);
                            refreshCaseList();
                            if (_currentCaseData != null && _currentCaseData.id === digitalContactEvent.caseId) {
                                if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                                    setCurrentCaseData(digitalContactEvent.case);
                                    if (digitalContactEvent.case.status === 'closed') {
                                        selectCaseItem(null);
                                    }
                                } else {
                                    if (digitalContactEvent.isCaseAssigned) {
                                        // Nothing
                                    } else {
                                        selectCaseItem(null);
                                    }
                                }
                            }
                        });
                        await refreshCaseList();
                    }
                    digital();
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
        _currentCaseData = caseData;
        setCurrentCaseData(caseData);
        if (caseData?.id != null) {
            // load conversationHistory xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        }
    }

    async function selectCallContactItem(callContactData: CallContactEvent | null, ignoreSelectCaseItem = false) {
        if (!ignoreSelectCaseItem) {
            selectCaseItem(null, true);
        }
        _currentCallContactData = callContactData;
        _currentVoiceContactData = voiceContactDataArray.filter(item => item.interactionId === callContactData?.interactionId)[0];
        setCurrentCallContactData(callContactData);
        setCurrentVoiceContactData(_currentVoiceContactData);
        // load call detail xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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

    return (
        <div className={`app`}>
            <div ref={caseListDivRef} className="case-list">
                {callContactDataArray.map((callContactData, index) => (
                    <React.Fragment key={index}>
                        <div className={`case-item ${(currentCallContactData != null && currentCallContactData.interactionId === callContactData.interactionId ? 'active' : '')}`} onClick={() => selectCallContactItem(callContactData)}>
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
                {caseDataList.map((caseData, index) => (
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