import {
  FirebaseAdminFcmProvider,
  isFirebaseAdminConfigured,
} from '../firebase-admin-fcm.provider';

const sendMock = jest.fn();
const initializeAppMock = jest.fn();
const certMock = jest.fn((value: unknown) => value);

jest.mock('firebase-admin', () => ({
  get apps() {
    return mockApps;
  },
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  credential: { cert: (value: unknown) => certMock(value) },
}));

let mockApps: Array<{ name: string } | null> = [];

function buildApp(name: string) {
  return {
    name,
    messaging: () => ({ send: sendMock }),
  };
}

beforeEach(() => {
  mockApps = [];
  sendMock.mockReset();
  initializeAppMock.mockReset();
  certMock.mockClear();
  initializeAppMock.mockImplementation(() => buildApp('daladrop-push'));
});

describe('isFirebaseAdminConfigured', () => {
  it('rejects placeholders and incomplete credentials', () => {
    expect(
      isFirebaseAdminConfigured({
        projectId: 'your_project_id',
        clientEmail: 'service-account@your_project.example.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      }),
    ).toBe(false);
    expect(
      isFirebaseAdminConfigured({
        projectId: 'daladrop-prod',
        clientEmail: '',
        privateKey: 'x',
      }),
    ).toBe(false);
    expect(
      isFirebaseAdminConfigured({
        projectId: 'daladrop-prod',
        clientEmail: 'ops@example.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
    ).toBe(false);
    expect(isFirebaseAdminConfigured({})).toBe(false);
    expect(
      isFirebaseAdminConfigured({
        projectId: 'daladrop-prod',
        clientEmail: 'firebase-adminsdk@daladrop-prod.iam.gserviceaccount.com',
        privateKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
      }),
    ).toBe(false);
  });

  it('accepts real-looking service account credentials', () => {
    expect(
      isFirebaseAdminConfigured({
        projectId: 'daladrop-prod',
        clientEmail: 'firebase-adminsdk@daladrop-prod.iam.gserviceaccount.com',
        privateKey:
          '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg==\n-----END PRIVATE KEY-----\n',
      }),
    ).toBe(true);
  });
});

describe('FirebaseAdminFcmProvider', () => {
  const credentials = {
    projectId: 'daladrop-prod',
    clientEmail: 'firebase-adminsdk@daladrop-prod.iam.gserviceaccount.com',
    privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
  };

  it('initializes a named app when none exists', () => {
    const provider = new FirebaseAdminFcmProvider(credentials);
    expect(provider.name).toBe('fcm');
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(initializeAppMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: credentials.projectId }),
      'daladrop-push',
    );
    expect(certMock).toHaveBeenCalledWith({
      projectId: credentials.projectId,
      clientEmail: credentials.clientEmail,
      privateKey: credentials.privateKey,
    });
  });

  it('reuses an existing firebase app when present', () => {
    mockApps = [null, buildApp('daladrop-push')];
    new FirebaseAdminFcmProvider(credentials);
    expect(initializeAppMock).not.toHaveBeenCalled();
  });

  it('sends a push message and reports acceptance', async () => {
    sendMock.mockResolvedValue('projects/daladrop/messages/123');
    const provider = new FirebaseAdminFcmProvider(credentials);
    const result = await provider.send({
      token: 'device-token',
      title: 'Order update',
      body: 'Your order is on the way',
      data: { orderId: 'o1' },
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'device-token',
        notification: { title: 'Order update', body: 'Your order is on the way' },
        data: { orderId: 'o1' },
        android: { priority: 'high' },
      }),
    );
    expect(result).toEqual({
      provider: 'fcm',
      messageId: 'projects/daladrop/messages/123',
      accepted: true,
    });
  });
});
