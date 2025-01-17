import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
    <div className="app">
        <div className="customers-list sidebar-collapse">
            <span id="sidebar-collapse-close" className="sidebar-collapse-btn">&lt;&lt;</span>
            <span id="sidebar-collapse-open" className="sidebar-collapse-btn">&gt;&gt;</span>
            <div className="agent-profile">
                <div className="profile-info">
                    <img src="@agentAvatar" alt="Agent" className="avatar" />
                    <div>
                        <div>@agentName</div>
                        <div style={{ fontSize: '0.8em', color: '#666'}}>Online: 00:30:43</div>
                    </div>
                </div>
                <div className="agent-status">
                    <select className="status-selector">
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                        <option value="acw">After Call Work</option>
                        <option value="busy">Busy</option>
                    </select>
                </div>
            </div>
        </div>
        <div className="chat-container">
            <div className="chat-header">
                <div className="profile-info">
                    <img src="https://icons.iconarchive.com/icons/martz90/circle/48/video-camera-icon.png" alt="Customer" className="avatar" />
                    <div>
                        <div className="profile-info-name">N/A</div>
                        <div className="message-time">N/A</div>
                    </div>
                </div>
            </div>

            <div className="chat-messages" id="chatMessages">
            </div>

            <div className="chat-input">
                <div className="attachment-options">
                    <input type="file" id="fileInput" multiple style={{ display: 'none' }} />
                    <button className="attachment-btn" /*onclick="document.getElementById('fileInput').click()"*/>📎 File</button>
                    <button className="attachment-btn" id="recordButton">🎤 Record</button>
                    <input type="file" id="imageInput" accept="image/*" style={{ display: 'none' }} />
                    <button className="attachment-btn" /*onclick="document.getElementById('imageInput').click()"*/>🖼️ Image</button>
                    <input type="file" id="videoInput" accept="video/*" style={{ display: 'none' }} />
                    <button className="attachment-btn" /*onclick="document.getElementById('videoInput').click()"*/>🎥 Video</button>
                </div>
                <div className="input-container">
                    <textarea className="message-input" placeholder="Type a message..." id="messageInput"></textarea>
                    <button className="send-btn" /*onclick="sendMessage()"*/>Send</button>
                </div>
            </div>
        </div>
    </div>
);
