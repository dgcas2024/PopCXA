import { useEffect, useRef, useState } from "react";
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
import {
    ACDSessionManager,
    ApiUriConstants,
    HttpUtilService,
    HttpClient,
    AgentSettings
} from "@nice-devone/core-sdk";
import {
    AuthToken,
    UnavailableCode,
    AgentStateEvent,
    AgentLegEvent,
    CallContactEvent,
    CXoneCase,
    SortingType,
    AgentSessionStatus,
    AgentSessionResponse,
    UserInfo
} from "@nice-devone/common-sdk";
import { CXoneClient } from "@nice-devone/agent-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
    //CXoneUser
} from "@nice-devone/auth-sdk";
import { DigitalService, CXoneDigitalClient } from "@nice-devone/digital-sdk";
import { CXoneVoiceClient } from "@nice-devone/voice-sdk";
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
    const utilService = new HttpUtilService();

    const [unavailableCodeArray, setUnavailableCodeArray] = useState<Array<UnavailableCode>>([]);
    const [dialNumber, setDialNumber] = useState('');

    const [webRTC, setWebRTC] = useState(false);
    const [authToken, setAuthToken] = useState("");
    const [agentStatus, setAgentStatus] = useState<AgentStateEvent>({} as AgentStateEvent);
    const [agentSession, setAgentSession] = useState<AgentSessionResponse | null>();
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

    const audioWebRTCRef = useRef<HTMLAudioElement>(null);

    const refreshCaseArray = async function (cuser: any) {
        const _caseDataArray = await digitalService.getDigitalContactSearchResult({
            sortingType: SortingType.DESCENDING,
            sorting: 'createdAt',
            inboxAssigneeAgentId: [{ id: cuser.user.agentId, name: cuser.user.nickname }],
            status: [{ id: 'new', name: 'new' }, { id: 'open', name: 'open' }, { id: 'pending', name: 'pending' }, { id: 'escalated', name: 'escalated' }, { id: 'resolved', name: 'resolved' }]
        }, true, true);
        console.log('Case data Array', _caseDataArray);
        for (var i = 0; i < _caseDataArray.data.length; i++) {
            if (!_caseDataArray.data[i].authorEndUserIdentity) {
                const baseUrl = cxoneAuth.getCXoneConfig().dfoApiBaseUri;
                const authToken = cxoneAuth.getAuthToken().accessToken;
                const url = baseUrl + ApiUriConstants.DIGITAL_CONTACT_DETAILS.replace('{contactId}', _caseDataArray.data[i].id);
                const reqInit = utilService.initHeader(authToken);
                const res: any = await HttpClient.get(url, reqInit);
                try {
                    _caseDataArray.data[i].authorEndUserIdentity = res.body.customer.identities[0];
                    _caseDataArray.data[i].authorEndUserIdentity.fullName = (_caseDataArray.data[i].authorEndUserIdentity.firstName ?? '') + ' ' + (_caseDataArray.data[i].authorEndUserIdentity.lastName ?? '')
                }
                catch {
                    //res.body.customer is null
                }
            }
        }
        const result = _caseDataArray.data as Array<any>;
        setCaseDataArray(result);
        return result;
    }

    const connectAgentLeg = (agentLegId: string) => {
        CXoneVoiceClient.instance.connectAgentLeg(agentLegId);
    }

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
        console.log('[IframeAuth].useEffect...');
        window.addEventListener('message', async function (evt) {
            if (evt.data.dest === 'Iframe2') {
                switch (evt.data.command) {
                    case 'setCurrentVoiceContactData': setCurrentVoiceContactData(evt.data.args); break;
                    case 'setCurrentCaseData': setCurrentCaseData(evt.data.args); break;
                    case 'setCurrentCallContactData': setCurrentCallContactData(evt.data.args); break;
                    case 'connectAgentLeg': connectAgentLeg(evt.data.args); break;
                    case 'askState': {
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setAgentSession', args: agentSessionRef.current }, '*')
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setAuthState', args: authStateRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCaseDataArray', args: caseDataArrayRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setVoiceContactDataArray', args: voiceContactDataArrayRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCallContactDataArray', args: callContactDataArrayRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: currentCaseDataRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentUserInfo', args: currentUserInfoRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: currentVoiceContactDataRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: currentCallContactDataRef.current }, '*');
                        window.parent?.postMessage({ dest: 'Iframe2', command: 'setAgentLegId', args: agentLegIdRef.current }, '*')
                        break;
                    }
                }
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setAgentSession', args: agentSession }, '*'); }, [agentSession]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setAuthState', args: authState }, '*'); }, [authState]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCaseDataArray', args: caseDataArray }, '*'); }, [caseDataArray]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setVoiceContactDataArray', args: voiceContactDataArray }, '*'); }, [voiceContactDataArray]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCallContactDataArray', args: callContactDataArray }, '*'); }, [callContactDataArray]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentVoiceContactData', args: currentVoiceContactData }, '*'); }, [currentVoiceContactData]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCaseData', args: currentCaseData }, '*'); }, [currentCaseData]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentUserInfo', args: currentUserInfo }, '*'); }, [currentUserInfo]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setCurrentCallContactData', args: currentCallContactData }, '*'); }, [currentCallContactData]);
    useEffect(() => { window.parent?.postMessage({ dest: 'Iframe2', command: 'setAgentLegId', args: agentLegId }, '*'); }, [agentLegId]);

    const setupEvent = function () {
        // ACD SDK consumption
        CXoneAcdClient.instance.initAcdEngagement();
        CXoneAcdClient.instance.session.agentStateService.agentStateSubject.subscribe((agentState: AgentStateEvent) => {
            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(agentState.agentStateData.StartTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //agentState.agentStateData.StartTime = new Date(originStartTime + delta);
            setAgentStatus(agentState);
            console.log('agentState', agentState);
        });
        CXoneAcdClient.instance.session.agentLegEvent.subscribe((data: AgentLegEvent) => {
            console.log('agentLegEvent', data);
            if (data.status?.toLowerCase() === "dialing") {
                setTimeout(() => {
                    if (callContactDataArrayRef.current.filter(x => x.status?.toLowerCase() === "incoming").length === 0) {
                        CXoneVoiceClient.instance.connectAgentLeg(data.agentLegId);
                    }
                }, 500);
                setAgentLegId(data.agentLegId);
                console.log('agentLegEvent Dialing...', data.agentLegId)
            }
            if (data.status === "Disconnected") {
                setAgentLegId(null);
                console.log('agentLegEvent Disconnected', data.agentLegId)
            }
        });
        CXoneAcdClient.instance.session.onAgentSessionChange?.subscribe(async (agentSessionChange) => {
            setAgentSession(agentSessionChange);
            console.log('onAgentSessionChange', agentSessionChange)
            switch (agentSessionChange.status) {
                case AgentSessionStatus.JOIN_SESSION_SUCCESS:
                case AgentSessionStatus.SESSION_START: {
                    window.parent?.postMessage({ dest: 'Parent', sessionStarted: true }, '*');
                    console.log("Session started successfully.....");
                    break;
                }
                case AgentSessionStatus.SESSION_END: {
                    window.parent?.postMessage({ dest: 'Parent', sessionEnded: true }, '*');
                    console.log("Session ended successfully.....");
                    break;
                }
                case AgentSessionStatus.JOIN_SESSION_FAILURE:
                    window.parent?.postMessage({ dest: 'Parent', sessionEnded: true }, '*');
                    console.log("Session join failed.....");
                    break;
            }
        });
        CXoneAcdClient.instance.contactManager.voiceContactUpdateEvent.subscribe((voiceContactEvent: { contactID: string, status: string, agentMuted: boolean }) => {
            voiceContactEvent = {
                contactID: voiceContactEvent.contactID,
                status: voiceContactEvent.status,
                agentMuted: voiceContactEvent.agentMuted,
            }
            console.log("voiceContactUpdateEvent", voiceContactEvent);

            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(voiceContactEvent.startTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //voiceContactEvent.startTime = new Date(originStartTime + delta);

            if (currentVoiceContactDataRef.current?.contactID === voiceContactEvent.contactID) {
                setCurrentVoiceContactData(voiceContactEvent);
                if (voiceContactEvent.status === 'Disconnected') {
                    setCurrentVoiceContactData(null);
                    window.parent?.postMessage({ dest: 'Iframe2', command: 'selectCallContactItem', args: null }, '*');
                }
            }

            setVoiceContactDataArray(arr => arr.filter(item => item.contactID !== voiceContactEvent.contactID));
            if (voiceContactEvent.status !== 'Disconnected') {
                setVoiceContactDataArray(arr => [...arr, voiceContactEvent]);
            }
        });
        ACDSessionManager.instance.callContactEventSubject.subscribe((callContactEvent: CallContactEvent) => {
            console.log("callContactEvent", callContactEvent);

            //const serverTime = DateTimeUtilService.getServerTimestamp();
            //const originStartTime = new Date(callContactEvent.startTime).getTime();
            //const delta = new Date().getTime() - serverTime;
            //callContactEvent.startTime = new Date(originStartTime + delta);

            if (currentCallContactDataRef.current?.contactId === callContactEvent.contactId) {
                setCurrentCallContactData(callContactEvent);
                if (callContactEvent.status === 'Disconnected') {
                    setCurrentCallContactData(null);
                    window.parent?.postMessage({ dest: 'Iframe2', command: 'selectCallContactItem', args: null }, '*');
                }
            }

            setCallContactDataArray(arr => {
                const contactId = callContactEvent.contactId;
                if (arr.filter(item => item.contactId === contactId).length === 0 && callContactEvent.status !== 'Disconnected') {
                    const processedContactIds = JSON.parse(localStorage.getItem('processedContactIds') ?? '[]') || [];
                    if (!processedContactIds.includes(contactId)) {
                        processedContactIds.push(contactId);
                        localStorage.setItem('processedContactIds', JSON.stringify(processedContactIds));
                        window.parent?.postMessage({ dest: 'Parent', callContactEvent: callContactEvent }, '*');
                    }
                }
                return arr.filter(item => item.contactId !== callContactEvent.contactId);
            });
            if (callContactEvent.status !== 'Disconnected') {
                setCallContactDataArray(arr => [...arr, callContactEvent]);
            }
        });

        // Digital SDK consumption
        CXoneDigitalClient.instance.initDigitalEngagement();
        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactNewMessageEvent?.subscribe((digitalContactNewMessageEvent) => {
            console.log("onDigitalContactNewMessageEvent", digitalContactNewMessageEvent);
        });
        CXoneDigitalClient.instance.digitalContactManager.onDigitalContactEvent?.subscribe((digitalContactEvent) => {
            console.log("onDigitalContactEvent", digitalContactEvent);
            const contactId = digitalContactEvent.case.contactId;
            if (caseDataArrayRef.current.filter(item => item.contactId === digitalContactEvent.case.contactId).length === 0 && digitalContactEvent.status !== 'close' && digitalContactEvent.isCaseAssigned) {
                const processedContactIds = JSON.parse(localStorage.getItem('processedContactIds') ?? '[]') || [];
                if (!processedContactIds.includes(contactId)) {
                    processedContactIds.push(contactId);
                    localStorage.setItem('processedContactIds', JSON.stringify(processedContactIds));
                    window.parent?.postMessage({ dest: 'Parent', digitalContactEvent: digitalContactEvent.case }, '*');
                }
            }
            const runAsync = async () => {
                var arr = await refreshCaseArray(currentUserInfoRef.current);
                if (currentCaseDataRef.current?.id === digitalContactEvent.caseId) {
                    if (digitalContactEvent.eventDetails.eventType === "CaseStatusChanged") {
                        const _case = arr.filter(x => x.id === digitalContactEvent.case.id)[0]
                        setCurrentCaseData(_case);
                        if (_case.status === 'closed') {
                            window.parent?.postMessage({ dest: 'Iframe2', command: 'selectCaseItem', args: null }, '*');
                        }
                    } else {
                        if (digitalContactEvent.isCaseAssigned) {
                            window.parent?.postMessage({ dest: 'Iframe2', command: 'handleSetMessageData', args: digitalContactEvent.messages }, '*');
                        } else {
                            window.parent?.postMessage({ dest: 'Iframe2', command: 'selectCaseItem', args: null }, '*');
                        }
                    }
                }
            }
            runAsync();
        });
    }

    const setup = async function () {
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
        await refreshCaseArray(cuser);
    }

    useEffect(() => {
        if (!webRTC && (agentSession?.status === AgentSessionStatus.SESSION_START || agentSession?.status === AgentSessionStatus.JOIN_SESSION_SUCCESS) && currentUserInfo) {
            const exec = async function () {
                try {
                    if (audioWebRTCRef.current) {
                        const agentSettings = (await CXoneClient.instance.agentSetting.getAgentSettings()) as AgentSettings;
                        const getUserInfo = (await CXoneClient.instance.cxoneUser.getUserDetails()) as UserInfo;
                        if (agentSettings && getUserInfo.icAgentId) {
                            const settings = {
                                agentId: getUserInfo.icAgentId,
                                agentSettings: agentSettings,
                                userInfo: getUserInfo,
                            };
                            CXoneVoiceClient.instance.connectServer(settings.agentId, settings.agentSettings, audioWebRTCRef.current, "Poptech CXAgent");
                            setWebRTC(true);
                            console.log("Connected to WebRTC");
                        }
                    } else {
                        //alert('Connected to WebRTC error: not found audio tag');
                        console.error('Connected to WebRTC error: not found audio tag');
                    }
                } catch (e) {
                    console.error('Connected to WebRTC error', e)
                }
            }
            exec();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agentSession]);

    useEffect(() => {
        console.log('[IframeAuth].useEffect...')
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

                    setupEvent();
                    setup();
                    try {
                        CXoneAcdClient.instance.session.joinSession();
                    } catch { }
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
        if (voiceConnection_selectedOption !== 'softphone' && (voiceConnection_inputValue ?? '') === '') {
            alert('Error');
            return;
        }
        try {
            await CXoneAcdClient.instance.session.startSession({
                stationId: voiceConnection_selectedOption === 'stationId' ? voiceConnection_inputValue : '',
                stationPhoneNumber: voiceConnection_selectedOption === 'phoneNumber' ? voiceConnection_inputValue : voiceConnection_selectedOption === 'softphone' ? 'WebRTC' : ''
            });
            await CXoneAcdClient.instance.session.joinSession();
        } catch {
            try {
                await CXoneAcdClient.instance.session.joinSession();
            } catch { }
        }
        await setup();
        voiceConnection_setIsInputDisabled(false);
        voiceConnection_setSelectedOption('phone');
    }

    async function updateAgentState(event: any) {
        if (event.target.value === '0000') {
            CXoneAcdClient.instance.session.endSession({
                endContacts: true,
                forceLogoff: true,
                ignorePersonalQueue: true
            });
            return;
        }
        const state = JSON.parse(event.target.value) as { state: string, reason: string };
        console.log('[IframeAuth].updateAgentState', state);
        await CXoneAcdClient.instance.session.agentStateService.setAgentState({
            state: state.state,
            reason: state.reason,
            isACW: false
        });
    }

    function handleAuthButtonClick() {
        cxoneAuth.init(authSetting);
        cxoneAuth.getAuthorizeUrl('page', 'S256').then((authUrl: string) => {
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

    const handleDial = async () => {
        if (!dialNumber) {
            alert('please enter dial number');
            return;
        }
        const skills = await CXoneAcdClient.instance.getAgentSkills(currentUserInfoRef.current.user.agentId);
        console.log('[IframeAuth].Skill', skills)
        const dialInfo = {
            skillId: skills[0].skillId,
            phoneNumber: dialNumber,
        };
        await CXoneAcdClient.instance.contactManager.voiceService.dialPhone(dialInfo);
    };

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

    if (agentSession?.status !== AgentSessionStatus.SESSION_START && agentSession?.status !== AgentSessionStatus.JOIN_SESSION_SUCCESS) {
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
                            <select style={{
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
                            }} onChange={voiceConnection_handleSelectChange}>
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
                                style={{
                                    padding: '8px 12px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '12px',
                                    outline: 'none'
                                }} />
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
                <select style={{
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
                }} onChange={updateAgentState} value={JSON.stringify(currentState)}>
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

                <div style={{ display: 'flex', gap: '5px' }}>
                    <div style={{ 
                        display: 'flex',
                        border: '1px solid #ccc',
                        borderRadius: '5px',
                        overflow: 'hidden' 
                    }}>
                        <audio hidden={true} ref={audioWebRTCRef} id="audio" controls autoPlay />
                        <input
                            type="text"
                            value={dialNumber}
                            onChange={(e) => setDialNumber(e.target.value)}
                            placeholder="Dial number"
                            style={{
                                padding: '6px 12px',
                                border: 'none',
                                fontSize: '14px',
                                outline: 'none',
                                width: '130px'
                            }}
                        />
                        <button
                            onClick={handleDial}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderLeft: '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <i className="fas fa-phone"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default IframeAuth;