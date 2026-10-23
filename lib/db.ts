/**
 * Yerel veritabanı katmanı.
 *
 * Android'de (Capacitor) uygulamanın özel depolama alanında ŞİFRESİZ bir SQLite
 * dosyası oluşturulur:  /data/data/<paket>/databases/idleforestSQLite.db
 * Tarayıcıda (geliştirme sırasında) otomatik olarak localStorage'a düşer.
 *
 * Tüm oyun verisi `kv` tablosunda JSON olarak tutulur.
 */
import { Capacitor } from "@capacitor/core";
import {
	CapacitorSQLite,
	SQLiteConnection,
	type SQLiteDBConnection,
} from "@capacitor-community/sqlite";

const DB_NAME = "idleforest";
const WEB_PREFIX = "idleforest_db:";

let sqlite: SQLiteConnection | null = null;
let conn: SQLiteDBConnection | null = null;
let opening: Promise<SQLiteDBConnection | null> | null = null;

const isNative = () => Capacitor.isNativePlatform();

async function open(): Promise<SQLiteDBConnection | null> {
	if (!isNative()) return null;
	if (conn) return conn;
	if (opening) return opening;

	opening = (async () => {
		try {
			sqlite = new SQLiteConnection(CapacitorSQLite);

			const consistent = (await sqlite.checkConnectionsConsistency()).result;
			const exists = (await sqlite.isConnection(DB_NAME, false)).result;

			let db: SQLiteDBConnection;
			if (consistent && exists) {
				db = await sqlite.retrieveConnection(DB_NAME, false);
			} else {
				// encrypted=false, mode="no-encryption" -> şifresiz
				db = await sqlite.createConnection(
					DB_NAME,
					false,
					"no-encryption",
					1,
					false,
				);
			}
			await db.open();
			await db.execute(
				`CREATE TABLE IF NOT EXISTS kv (
					key        TEXT PRIMARY KEY NOT NULL,
					value      TEXT NOT NULL,
					updated_at INTEGER NOT NULL
				);`,
			);
			conn = db;
			return db;
		} catch (e) {
			console.error("[db] open failed", e);
			opening = null;
			return null;
		}
	})();

	return opening;
}

export async function dbGet(key: string): Promise<string | null> {
	const db = await open();
	if (!db) {
		try {
			return localStorage.getItem(WEB_PREFIX + key);
		} catch {
			return null;
		}
	}
	try {
		const res = await db.query("SELECT value FROM kv WHERE key = ?;", [key]);
		const row = res.values?.[0];
		return row ? (row.value as string) : null;
	} catch (e) {
		console.error("[db] get failed", e);
		return null;
	}
}

export async function dbSet(key: string, value: string): Promise<boolean> {
	const db = await open();
	if (!db) {
		try {
			localStorage.setItem(WEB_PREFIX + key, value);
			return true;
		} catch (e) {
			console.error("[db] web set failed", e);
			return false;
		}
	}
	try {
		await db.run(
			"INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?);",
			[key, value, Date.now()],
		);
		return true;
	} catch (e) {
		console.error("[db] set failed", e);
		return false;
	}
}

export async function dbDelete(key: string): Promise<void> {
	const db = await open();
	if (!db) {
		try {
			localStorage.removeItem(WEB_PREFIX + key);
		} catch {}
		return;
	}
	try {
		await db.run("DELETE FROM kv WHERE key = ?;", [key]);
	} catch (e) {
		console.error("[db] delete failed", e);
	}
}
