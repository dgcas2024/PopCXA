import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import IframeAuth from './IframeAuth';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
const searchParams = new URLSearchParams(window.location.search);
const iframe = searchParams.get("iframe") || "";
const iframeText = searchParams.get("iframeText") || "";
if (iframe === 'auth') {
    root.render(
        <IframeAuth iframeText={iframeText} />
    );
} else {
    root.render(
        <App />
    );
}

