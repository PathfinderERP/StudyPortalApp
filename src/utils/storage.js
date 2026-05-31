import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const storage = {
  getItem: async (key) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          return localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      console.error(`Error reading key ${key} from storage:`, err);
      return null;
    }
  },
  
  setItem: async (key, value) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.error(`Error writing key ${key} to storage:`, err);
    }
  },
  
  deleteItem: async (key) => {
    try {
      if (isWeb) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      console.error(`Error deleting key ${key} from storage:`, err);
    }
  }
};
