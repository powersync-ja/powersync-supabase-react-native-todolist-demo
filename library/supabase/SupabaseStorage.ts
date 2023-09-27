import EncryptedStorage from 'react-native-encrypted-storage';
import { SupportedStorage } from '@supabase/supabase-js';

export const SupabaseStorage: SupportedStorage = {
  getItem: async (key) => {
    try {
      const session = await EncryptedStorage.getItem(key);

      return session ?? null;
    } catch (error) {
      // There was an error on the native side
      return null;
    }
  },
  setItem: async (key, value) => {
    await EncryptedStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (ex) {}
  }
};
