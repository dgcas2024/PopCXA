/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */

import './Call.css';

import { useEffect, useRef, useState } from "react";
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
    CXoneCase
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
import { CXoneClient, ContactService, VoiceControlService, AgentLegService } from "@nice-devone/agent-sdk";
import React from "react";

const Call = ({ currentCallContactData, currentVoiceContactData }: any) => {
    const agentLegService = new AgentLegService();

    useEffect(() => {
        
    }, []);

    const voiceControlService = new VoiceControlService();
    const contactService = new ContactService();

    const _currentCallContactData = currentCallContactData as CallContactEvent;
    const _currentVoiceContactData = currentVoiceContactData as CXoneVoiceContact;

    async function handleAccept() {
        await contactService.acceptContact(_currentCallContactData.contactId);
    }

    async function handleReject() {
        await voiceControlService.endContact(_currentCallContactData.contactId);
    }

    async function handleTransfer() {

    }

    async function handleHold() {
        if (_currentVoiceContactData.status === 'Holding') {
            await voiceControlService.resumeContact(_currentCallContactData.contactId);
        } else {
            await voiceControlService.holdContact(_currentCallContactData.contactId);
        }
    }

    async function handleMute() {
        if (_currentVoiceContactData.agentMuted) {
            await voiceControlService.unmuteAgent();
        } else {
            await voiceControlService.muteAgent();
        }
    }

    async function handleMask() {
        if (_currentCallContactData.status === "Masking") {
            await voiceControlService.unmaskCall(_currentCallContactData.contactId);
        } else {
            await voiceControlService.maskCall(_currentCallContactData.contactId);
        }
    }

    async function handleHangup() {
        await voiceControlService.endContact(_currentCallContactData.contactId);
    }

    return (
        <div className="call-container">
            <div className="caller-info">
                <div className="caller-avatar">
                    <i className="fas fa-user fa-2x" style={{ color: '#666' }}></i>
                </div>
                <div className="caller-name">{_currentCallContactData.ani}</div>
                {/*<div className="caller-number">{_currentCallContactData.ani}</div>*/}
                <div className="call-status">{_currentCallContactData.status}</div>
                <div className="timer" data-starttime={_currentCallContactData.startTime}>00:00:00</div>
            </div>
            {_currentCallContactData.status === "Active" || _currentCallContactData.status === "Holding" || _currentCallContactData.status === "Masking" ? (
                <React.Fragment>
                    <div className="call-controls">
                        <button disabled={_currentCallContactData.status === "Masking"} className={`action-button hold ${_currentVoiceContactData.status === 'Holding' ? 'active' : ''}`} onClick={handleHold}>
                            <i className="fas fa-pause"></i>
                            <i className="fas fa-play active-ico"></i>
                        </button>
                        <button className={`action-button mute ${_currentVoiceContactData.agentMuted ? 'active' : ''}`} onClick={handleMute}>
                            <i className="fas fa-microphone"></i>
                            <i className="fas fa-microphone-slash active-ico"></i>
                        </button>
                        <button disabled={_currentVoiceContactData.status === 'Holding'} className={`action-button mask ${_currentCallContactData.status === "Masking" ? 'active' : ''}`} onClick={handleMask}>
                            <i className="fas fa-masks-theater"></i>
                            <i className="fas fa-masks-theater active-ico"></i>
                        </button>
                    </div>
                    <div className="call-controls">
                        <button className="action-button transfer" onClick={handleTransfer}>
                            <i className="fas fa-exchange-alt"></i>
                        </button>
                        <button disabled={_currentVoiceContactData.status === 'Holding' || _currentVoiceContactData.agentMuted || _currentCallContactData.status === "Masking"} className="action-button hangup" onClick={handleHangup}>
                            <i className="fas fa-phone-slash"></i>
                        </button>
                    </div>
                </React.Fragment>
            ) : (
                <div className="call-actions">
                    <button className="action-button accept" onClick={handleAccept}>
                        <i className="fas fa-phone"></i>
                    </button>
                    <button className="action-button reject" onClick={handleReject}>
                        <i className="fas fa-phone-slash"></i>
                    </button>
                    <button className="action-button transfer" onClick={handleTransfer}>
                        <i className="fas fa-exchange-alt"></i>
                    </button>
                </div>
            )}
        </div>
    );
};
export default Call;