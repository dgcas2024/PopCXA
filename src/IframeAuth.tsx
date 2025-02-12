﻿import { useEffect, useRef, useState } from "react";
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    UnavailableCode,
    AgentStateEvent,
} from "@nice-devone/common-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
} from "@nice-devone/auth-sdk";
import { DigitalService } from "@nice-devone/digital-sdk";
import React from "react";

import './components/Call';

const authSetting: AuthSettings = {
    cxoneHostname: process.env.REACT_APP__CXONE_HOST_NAME || '',
    clientId: process.env.REACT_APP__CXONE_CLIENT_ID || '',
    redirectUri: process.env.REACT_APP__CXONE_AUTH_REDIRECT_URL || '',
};

const defaultUserAvatar = 'https://app-eu1.brandembassy.com/img/user-default.png';

const IframeAuth = ({ iframeText }: any) => {
    const digitalService = new DigitalService();
    const cxoneAuth = CXoneAuth.instance;

    const [authState, setAuthState] = useState("");
    const [, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);
    const [currentUserInfo, setCurrentUserInfo] = useState<any>();
    const [unavailableCodeArray, setUnavailableCodeArray] = useState<Array<UnavailableCode>>([]);

    const setupAcd = async () => {
        CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
            setAgentStatus(agentState);
            console.log('agentState', agentState);
        });

        const _unavailableCodeArray = await CXoneAcdClient.instance.session.agentStateService.getTeamUnavailableCodes();
        if (Array.isArray(_unavailableCodeArray)) {
            _unavailableCodeArray.push({
                isActive: true,
                isAcw: false,
                reason: ''
            } as UnavailableCode);
            setUnavailableCodeArray(_unavailableCodeArray);
        }
        const cuser = await digitalService.getDigitalUserDetails() as any;
        setCurrentUserInfo(cuser);
        console.log(cuser);
    }

    useEffect(() => {
        console.log('useEffect...')
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

                    const acd = async function () {
                        CXoneAcdClient.instance.initAcdEngagement();
                        if (ACDSessionManager.instance.hasSessionId) {
                            const join_ss = await CXoneAcdClient.instance.session.joinSession();
                            console.log('[0]. Join session', join_ss);
                            window.parent?.postMessage({ sessionStarted: true }, '*');
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

    const [voiceConnection_selectedOption, voiceConnection_setSelectedOption] = useState('phone');
    const [voiceConnection_inputValue, voiceConnection_setInputValue] = useState('');
    const [voiceConnection_isInputDisabled, voiceConnection_setIsInputDisabled] = useState(false);

    const voiceConnection_handleSelectChange = (e: any) => {
        voiceConnection_setSelectedOption(e.target.value);
        if (e.target.value === 'softphone') {
            voiceConnection_setInputValue('');
            voiceConnection_setIsInputDisabled(true);
        } else {
            voiceConnection_setIsInputDisabled(false);
        }
    };

    const voiceConnection_connect = async () => {
        if (!ACDSessionManager.instance.hasSessionId) {
            try {
                const start_ss = await CXoneAcdClient.instance.session.startSession({
                    stationId: voiceConnection_selectedOption === 'stationId' ? voiceConnection_inputValue : '',
                    stationPhoneNumber: voiceConnection_selectedOption === 'phoneNumber' ? voiceConnection_inputValue : voiceConnection_selectedOption === 'softphone' ? 'WebRTC' : ''
                });
                console.log('Start session', start_ss);
                window.parent?.postMessage({ sessionStarted: true }, '*');
            } catch { }
        }
        const join_ss = await CXoneAcdClient.instance.session.joinSession();
        console.log('[1]. Join session', join_ss);
        window.parent?.postMessage({ sessionStarted: true }, '*');
        await setupAcd();
    }

    async function updateAgentState(event: any) {
        if (event.target.value === '0000') {
            const end_ss = await CXoneAcdClient.instance.session.endSession({
                endContacts: true,
                forceLogoff: true,
                ignorePersonalQueue: true
            });
            console.log('End session', end_ss)
            window.parent?.postMessage({ sessionEnded: true }, '*');
            await setupAcd();
            return;
        }
        const state = JSON.parse(event.target.value) as { state: string, reason: string };
        console.log('updateAgentState', state);
        await CXoneAcdClient.instance.session.agentStateService.setAgentState({
            state: state.state,
            reason: state.reason,
            isACW: false
        });
    }

    function handleAuthButtonClick() {
        cxoneAuth.init(authSetting);
        cxoneAuth.getAuthorizeUrl('page', 'S256').then((authUrl: string) => {
            //window.location.href = authUrl;
            const popupOptions = `width=500,height=800,scrollbars=yes,toolbar=no,left=${window.screenX + 300},top=${window.screenY + 100}`;
            const popupWindow = window.open(authUrl, "authWindow", popupOptions);
            window.addEventListener(
                "message",
                (event) => {
                    const message = event.data.message;
                    if (message && message["messageType"] === "Authenticated") {
                        const authObject: AuthWithCodeReq = {
                            clientId: authSetting.clientId,
                            code: message.code,
                        };
                        cxoneAuth.getAccessTokenByCode(authObject);
                        popupWindow?.close();
                    }
                },
                false
            );
        });
    }

    if (authState !== "AUTHENTICATED") {
        if (authState === "AUTHENTICATING") {
            return (
                <div className="app">
                    <div style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'center', alignItems: 'start', flexDirection: 'column' }}>
                        <span
                            style={{
                                width: '200px',
                                height: '35px',
                                fontSize: '14px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            AUTHENTICATING
                        </span>
                    </div>
                </div>
            )
        }
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'center', alignItems: 'start', flexDirection: 'column' }}>
                    <button
                        onClick={handleAuthButtonClick}
                        style={{
                            width: '200px',
                            height: '35px',
                            fontSize: '14px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {iframeText === '' ? 'Đăng nhập' : iframeText}
                    </button>
                </div>
            </div>
        )
    }

    if (!ACDSessionManager.instance.hasSessionId) {
        return (
            <div className="app">
                <div style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'center', alignItems: 'start', flexDirection: 'column' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '10px',
                        margin: '0 auto'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <select style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '12px', outline: 'none' }} onChange={voiceConnection_handleSelectChange}>
                                <option value="phoneNumber">Phone Number</option>
                                <option value="stationId">Station ID</option>
                                <option value="softphone">Integrated Softphone</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', outline: 'none' }}>
                            <input type="text"
                                value={voiceConnection_inputValue}
                                onChange={(e) => voiceConnection_setInputValue(e.target.value)}
                                disabled={voiceConnection_isInputDisabled}
                                style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '12px' }} />
                        </div>

                        <button style={{
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                        }}
                            onClick={voiceConnection_connect}
                        >
                            Connect
                        </button>
                    </div>
                </div>
            </div>
        )
    }
    
    const otherStates: Array<{ state: string, reason: string }> = [];
    const currentState = { state: agentStatus?.currentState?.state ?? '', reason: agentStatus?.currentState?.reason ?? '' };
    if ([{ state: 'available', reason: '' }, ...unavailableCodeArray.filter(item => item.isActive && !item.isAcw).map(item => {
        return { state: 'unavailable', reason: item.reason };
    })].map(item => JSON.stringify(item)).filter(item => item === JSON.stringify(currentState)).length === 0) {
        otherStates.push(currentState);
    }

    return (
        <div className={`app`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                    src={currentUserInfo?.user?.publicImageUrl ?? defaultUserAvatar}
                    alt="Avatar"
                    style={{ borderRadius: '50%', width: '30px', height: '30px' }}
                />
                <div style={{ fontSize: '14px' }}>
                    <div>{currentUserInfo?.user?.fullName ?? 'N/A'}</div>
                    <div style={{ fontSize: '11px', color: '#888' }} data-starttime={agentStatus?.agentStateData?.StartTime}>00:00:00</div>
                </div>
                <select style={{ fontSize: '14px', padding: '2px', outline: 'none' }} onChange={updateAgentState} value={JSON.stringify(currentState)}>
                    <option value={JSON.stringify({ state: 'available', reason: '' })}>Available</option>
                    {otherStates.map((item, index) => {
                        return (
                            <React.Fragment key={index}>
                                <option value={JSON.stringify(item)}>{item.state.charAt(0).toUpperCase() + item.state.slice(1)} {(item.reason ?? '') !== '' ? ` - ${item.reason}` : ''}</option>
                            </React.Fragment>
                        )
                    })}
                    {unavailableCodeArray.filter(item => item.isActive && !item.isAcw).map((item, index) => {
                        return (
                            <React.Fragment key={index}>
                                <option value={JSON.stringify({ state: 'unavailable', reason: item.reason })}>Unavailable{(item.reason ?? '') !== '' ? ` - ${item.reason}` : ''}</option>
                            </React.Fragment>
                        )
                    })}
                    <option value="0000">Logout</option>
                </select>
            </div>
        </div>
    );
};
export default IframeAuth;