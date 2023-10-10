import EncryptedStorage from "react-native-encrypted-storage";

export class KVStorage {
    async getItem(key: string): Promise<string | null> {
        try {
            const session = await EncryptedStorage.getItem(key);
            return session ?? null;
        } catch (error) {
            // There was an error on the native side
            return null;
        }
    }

    async setItem(key: string, value: string): Promise<void> {
        await EncryptedStorage.setItem(key, value);
    }

    async removeItem(key: string): Promise<void> {
        try {
            await EncryptedStorage.removeItem(key);
        } catch (ex) {
        }
    }
};
