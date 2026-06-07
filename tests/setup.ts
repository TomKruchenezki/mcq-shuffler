import '@testing-library/jest-dom'
import { indexedDB, IDBKeyRange } from 'fake-indexeddb'

Object.defineProperty(globalThis, 'indexedDB', { value: indexedDB, writable: true, configurable: true })
Object.defineProperty(globalThis, 'IDBKeyRange', { value: IDBKeyRange, writable: true, configurable: true })
