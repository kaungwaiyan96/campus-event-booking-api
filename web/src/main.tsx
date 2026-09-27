import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApiProvider } from './api/ApiProvider';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { msalInstance } from './auth/msal';
import './styles/tokens.css';
import './styles/global.css';

function renderApplication() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ApiProvider>
            <App />
          </ApiProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}

async function bootstrapAuthentication() {
  await msalInstance.initialize();
  const redirectResult = await msalInstance.handleRedirectPromise({ navigateToLoginRequestUrl: false });
  const account = redirectResult?.account
    ?? msalInstance.getActiveAccount()
    ?? msalInstance.getAllAccounts()[0];

  if (account) {
    msalInstance.setActiveAccount(account);
  }
}

void bootstrapAuthentication().then(renderApplication, renderApplication);
