import { jest } from '@jest/globals';
import { getSourceMetadata, updateSourceMetadata } from '../../services/storage';

jest.mock('../../services/storage', () => ({
  getSourceMetadata: jest.fn(),
  updateSourceMetadata: jest.fn()
}));

const mockedGetSourceMetadata = getSourceMetadata as jest.MockedFunction<typeof getSourceMetadata>;
const mockedUpdateSourceMetadata = updateSourceMetadata as jest.MockedFunction<typeof updateSourceMetadata>;

import { DropboxService } from '../../services/DropboxService';
import { GoogleDriveService } from '../../services/GoogleDriveService';
import { SupabaseService } from '../../services/SupabaseService';

describe('storage SDK integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes Dropbox token calls through storage helpers', async () => {
    mockedGetSourceMetadata.mockResolvedValue({
      dropbox_access_token: 'a',
      dropbox_refresh_token: 'b',
      dropbox_expires_at: '1',
      dropbox_account_id: 'acc',
      dropbox_team_member_id: 'team',
      dropbox_is_team_account: 'false',
      dropbox_home_namespace_id: 'home',
      dropbox_root_namespace_id: 'root'
    });
    const svc = new DropboxService();
    await svc.getStoredTokens('o','s');
    expect(mockedGetSourceMetadata).toHaveBeenCalled();
    await svc.storeTokens('o','s',{
      access_token:'a',
      refresh_token:'b',
      expires_at:1,
      account_id:'acc'
    } as any);
    expect(mockedUpdateSourceMetadata).toHaveBeenCalled();
  });

  it('routes Google Drive token calls through storage helpers', async () => {
    mockedGetSourceMetadata.mockResolvedValue({
      gdrive_access_token: 'a',
      gdrive_refresh_token: 'b',
      gdrive_expires_at: '2',
      gdrive_token_type: 'bearer'
    });
    const svc = new GoogleDriveService();
    await svc.getStoredTokens('o','s');
    expect(mockedGetSourceMetadata).toHaveBeenCalled();
    await svc.storeTokens('o','s',{
      access_token:'a',
      refresh_token:'b',
      expires_at:2,
      token_type:'bearer'
    });
    expect(mockedUpdateSourceMetadata).toHaveBeenCalled();
  });

  it('routes Supabase token calls through storage helpers', async () => {
    mockedGetSourceMetadata.mockResolvedValue({
      supabase_access_token: 'a',
      supabase_refresh_token: 'b',
      supabase_expires_at: '3',
      supabase_token_type: 'bearer'
    });
    const svc = new SupabaseService();
    await svc.getStoredTokens('o','s');
    expect(mockedGetSourceMetadata).toHaveBeenCalled();
    await svc.storeTokens('o','s',{
      access_token:'a',
      refresh_token:'b',
      expires_at:3,
      token_type:'bearer'
    });
    expect(mockedUpdateSourceMetadata).toHaveBeenCalled();
  });
});
