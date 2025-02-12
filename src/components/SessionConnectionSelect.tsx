/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useRef, useState, CSSProperties } from "react";
import { v4 as uuidv4 } from 'uuid';
import { CXoneAcdClient, CXoneVoiceContact } from "@nice-devone/acd-sdk";
import {
    StorageKeys,
    ACDSessionManager,
    DateTimeUtilService,
    LocalStorageHelper
} from "@nice-devone/core-sdk";
import {
    AgentSessionStatus,
    AuthToken,
    EndSessionRequest,
    UnavailableCode,
    AgentStateEvent,
    SortingType,
    UserInfo,
    CallContactEvent,
    CXoneCase,
    CXoneMessageArray
} from "@nice-devone/common-sdk";
import {
    AuthSettings,
    AuthWithCodeReq,
    CXoneAuth,
    AuthStatus,
    AuthWithTokenReq,
    CXoneUser
} from "@nice-devone/auth-sdk";
import {
    CXoneDigitalClient,
    CXoneDigitalContact,
    DigitalService,
} from "@nice-devone/digital-sdk";
import { CXoneVoiceClient } from "@nice-devone/voice-sdk";
import { CXoneClient, ContactService, VoiceControlService } from "@nice-devone/agent-sdk";

function SessionConnectionSelect({ setupAcd }: any) {
    const [selectedOption, setSelectedOption] = useState('phone');
    const [inputValue, setInputValue] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    const styles = {
        container: {
            width: '300px',
            padding: '20px',
            margin: '20px auto',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#fff',
            fontFamily: 'Arial, sans-serif'
        },
        title: {
            fontSize: '18px',
            fontWeight: 'bold',
            marginBottom: '15px'
        },
        radioGroup: {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        },
        radioOption: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        input: {
            width: '100%',
            padding: '8px',
            marginTop: '5px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box' 
        },
        phoneNumberSection: {
            marginTop: '15px'
        },
        label: {
            fontSize: '14px',
            color: '#666'
        },
        rememberMe: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '15px'
        },
        buttonGroup: {
            display: 'flex',
            gap: '10px',
            marginTop: '15px'
        },
        connectButton: {
            padding: '8px 16px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        },
        closeButton: {
            padding: '8px 16px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
        }
    };

    useEffect(() => {
        CXoneAcdClient.instance.initAcdEngagement();
    }, []);

    async function Connect() {
        if (!ACDSessionManager.instance.hasSessionId) {
            try {
                const start_ss = await CXoneAcdClient.instance.session.startSession({
                    stationId: selectedOption === 'station' ? inputValue : '',
                    stationPhoneNumber: selectedOption === 'phone' ? inputValue : selectedOption === 'softphone' ? 'WebRTC' : ''
                });
                console.log('Start session', start_ss);
            } catch { }
        }
        const join_ss = await CXoneAcdClient.instance.session.joinSession();
        console.log('Join session', join_ss);
        await setupAcd();
    }

    return (
        <div style={styles.container}>
            <h2 style={styles.title}>Voice Connection</h2>

            <div style={styles.radioGroup as CSSProperties}>
                <div style={styles.radioOption}>
                    <input
                        type="radio"
                        id="phone"
                        name="connectionType"
                        value="phone"
                        checked={selectedOption === 'phone'}
                        onChange={(e) => setSelectedOption(e.target.value)}
                    />
                    <label htmlFor="phone">Set Phone Number</label>
                </div>

                <div style={styles.radioOption}>
                    <input
                        type="radio"
                        id="station"
                        name="connectionType"
                        value="station"
                        checked={selectedOption === 'station'}
                        onChange={(e) => setSelectedOption(e.target.value)}
                    />
                    <label htmlFor="station">Set Station ID</label>
                </div>

                <div style={styles.radioOption}>
                    <input
                        type="radio"
                        id="softphone"
                        name="connectionType"
                        value="softphone"
                        checked={selectedOption === 'softphone'}
                        onChange={(e) => setSelectedOption(e.target.value)}
                    />
                    <label htmlFor="softphone">Integrated Softphone</label>
                </div>
            </div>

            {selectedOption !== 'softphone' && (
                <div style={styles.phoneNumberSection}>
                    <label style={styles.label}>Phone Number</label>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        style={styles.input as CSSProperties}
                    />
                </div>
            )}

            {/*<div style={styles.rememberMe}>*/}
            {/*    <input*/}
            {/*        type="checkbox"*/}
            {/*        id="remember"*/}
            {/*        checked={rememberMe}*/}
            {/*        onChange={(e) => setRememberMe(e.target.checked)}*/}
            {/*    />*/}
            {/*    <label htmlFor="remember">Remember Me</label>*/}
            {/*</div>*/}

            <div style={styles.buttonGroup}>
                <button style={styles.connectButton} onClick={Connect}>Connect</button>
                {/*<button style={styles.closeButton}>Close</button>*/}
            </div>
        </div>
    );
}
export default SessionConnectionSelect;