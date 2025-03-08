import './Call.css';

import { useEffect, useState } from "react";
import { } from 'uuid';
import { CXoneAcdClient } from "@nice-devone/acd-sdk";
import {
} from "@nice-devone/core-sdk";
import {
    CallContactEvent,
} from "@nice-devone/common-sdk";
import {
} from "@nice-devone/auth-sdk";
import {
} from "@nice-devone/digital-sdk";
import { CXoneVoiceClient } from "@nice-devone/voice-sdk";
import { /*ContactService,*/ VoiceControlService } from "@nice-devone/agent-sdk";
import React from "react";

interface Agent {
  id: string;
  name: string;
  state: string;
  avatar?: string;
}

const Call = ({ currentCallContactData, currentVoiceContactData, agentLegId }: any) => {
    const voiceControlService = new VoiceControlService();
    //const contactService = new ContactService();
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

    useEffect(() => {
        CXoneAcdClient.instance.initAcdEngagement();
    }, []);

    useEffect(() => {
        if (showTransferModal) {
            loadAvailableAgents();
        }
    }, [showTransferModal]);

    const loadAvailableAgents = async () => {
        try {
            const agents: [Agent] = [{
                id: '43890187',
                name: 'Agent2',
                state: 'Available',
                avatar: 'https://app-eu1.brandembassy.com/img/user-default.png'
            }];
            setAgents(agents);
        } catch (error) {
            console.error('Error loading agents:', error);
        }
    };

    const handleTransfer = async () => {
        if (!selectedAgent || !_currentCallContactData) {
            alert('Please select an agent to transfer to');
            return;
        }
        await CXoneAcdClient.instance.contactManager.voiceService.dialAgent(selectedAgent.id, _currentCallContactData.contactId);
        setShowTransferModal(false);
    };

    const handleColdTransfer = async () => {
        await CXoneAcdClient.instance.contactManager.voiceService.transferContact();
    };

    const filteredAgents = agents.filter(agent => 
        agent.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const _currentCallContactData = currentCallContactData as CallContactEvent;
    const _currentVoiceContactData = currentVoiceContactData as { contactID: string, status: string, agentMuted: boolean };

    if (_currentCallContactData == null || _currentVoiceContactData == null) {
        return (
            <div className="call-container">
                <div className="caller-info">
                    <div className="caller-avatar">
                        <i className="fas fa-user fa-2x" style={{ color: '#666' }}></i>
                    </div>
                    <div className="caller-name">Loading...</div>
                    <div className="call-status">Loading</div>
                    <div className="timer">Loading</div>
                </div>
            </div>
        );
    }

    async function handleAccept() {
        //await contactService.acceptContact(_currentCallContactData.contactId);
        CXoneVoiceClient.instance.connectAgentLeg(agentLegId);
    }

    async function handleReject() {
        await voiceControlService.endContact(_currentCallContactData.contactId);
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

    const transferModal = showTransferModal && (
        <React.Fragment>
            <div className="transfer-modal-backdrop" onClick={() => setShowTransferModal(false)} />
            <div className="transfer-modal">
                <div className="transfer-modal-header">
                    <h3>Transfer Call</h3>
                    <button className="transfer-modal-close" onClick={() => setShowTransferModal(false)}>×</button>
                </div>
                
                <input
                    type="text"
                    className="transfer-search"
                    placeholder="Search agents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="transfer-agents-list">
                    {filteredAgents.map(agent => (
                        <div key={agent.id} className={`transfer-agent-item ${selectedAgent?.id === agent.id ? 'selected' : ''}`} onClick={() => setSelectedAgent(agent)}>
                            <img src={agent.avatar} alt={agent.name} className="transfer-agent-avatar"/>
                            <div className="transfer-agent-info">
                                <div className="transfer-agent-name">{agent.name}</div>
                                <div className="transfer-agent-status">{agent.state}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button className="action-button transfer" onClick={handleTransfer} disabled={!selectedAgent} style={{ width: 'auto', padding: '0 20px', margin: 'auto' }}>
                        <i className="fas fa-exchange-alt"></i>
                    </button>
                </div>
            </div>
        </React.Fragment>
    );

    return (
        <div className="call-container">
            <div className="caller-info">
                <div className="caller-avatar">
                    <i className="fas fa-user fa-2x" style={{ color: '#666' }}></i>
                </div>
                {_currentCallContactData.status !== "Dialing" && (
                    <div className="caller-name">{_currentCallContactData.ani}{_currentCallContactData.ani === "REAGENT" ? (<div style={{ fontSize: '14px', color: '#777' }}>{_currentCallContactData.dnis}</div>) : (<></>)}</div>
                )}
                {_currentCallContactData.status === "Dialing" && (
                    <div className="caller-name">{_currentCallContactData.dnis}</div>
                )}
                {/*<div className="caller-number">{_currentCallContactData.ani}</div>*/}
                <div className="call-status">{_currentCallContactData.isInbound ? 'InboundCall' : 'OutboundCall'}: {_currentCallContactData.status}</div>
                <div className="timer" data-starttime={_currentCallContactData.startTime}>00:00:00</div>
            </div>
            {
                _currentCallContactData.ani === "REAGENT" && _currentCallContactData.status === "Active" && (
                    <div className="call-actions">
                        <button disabled={false} className="action-button transfer" onClick={handleColdTransfer}>
                            <i className="fas fa-exchange-alt" style={{ color: '#f44336' }}></i>
                        </button>
                        <button className="action-button hangup" onClick={handleHangup}>
                            <i className="fas fa-phone-slash"></i>
                        </button>
                    </div>
                )
            }
            {
                _currentCallContactData.ani !== "REAGENT" && (_currentCallContactData.status === "Active" || _currentCallContactData.status === "Holding" || _currentCallContactData.status === "Masking") && (
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
                            <button disabled={_currentVoiceContactData.status !== 'Holding'} className="action-button transfer" onClick={() => setShowTransferModal(true)}>
                                <i className="fas fa-exchange-alt"></i>
                            </button>
                            <button disabled={_currentVoiceContactData.status === 'Holding' || _currentVoiceContactData.agentMuted || _currentCallContactData.status === "Masking"} className="action-button hangup" onClick={handleHangup}>
                                <i className="fas fa-phone-slash"></i>
                            </button>
                        </div>
                    </React.Fragment>
                )
            }
            {
                _currentCallContactData.ani !== "REAGENT" && _currentCallContactData.status === "Incoming" && (
                    <div className="call-actions">
                        <button disabled={agentLegId == null} className="action-button accept" onClick={handleAccept}>
                            <i className="fas fa-phone"></i>
                        </button>
                        <button className="action-button reject" onClick={handleReject}>
                            <i className="fas fa-phone-slash"></i>
                        </button>
                        {/*<button disabled={true} className="action-button transfer" onClick={() => setShowTransferModal(true)}>*/}
                        {/*    <i className="fas fa-exchange-alt"></i>*/}
                        {/*</button>*/}
                    </div>
                )
            }
            {
                _currentCallContactData.ani !== "REAGENT" && _currentCallContactData.status === "Dialing" && (
                    <div className="call-actions">
                        <button className="action-button reject" onClick={handleReject}>
                            <i className="fas fa-phone-slash"></i>
                        </button>
                    </div>
                )
            }
            {transferModal}
        </div>
    );
};
export default Call;