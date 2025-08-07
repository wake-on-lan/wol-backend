export interface Message {
  data: string; // encrypted via AES from client
  key: string; // encrypted with public key
  iv: string; // encrypted with public key
}
