import { initialData, type LabData } from "../types";
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(
        new Error(
          "浏览器不支持 IndexedDB，资料仅在本次打开期间保留。请导出 JSON。",
        ),
      );
    const request = indexedDB.open("sens-lab", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("data");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "无法打开本地数据库，请检查隐私模式或存储权限，并导出 JSON。",
        ),
      );
    request.onblocked = () =>
      reject(new Error("本地数据库被其他标签页占用，请关闭其他页面后重试。"));
  }));
}
export async function loadData(): Promise<LabData> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const r = database.transaction("data").objectStore("data").get("lab");
    r.onsuccess = () => resolve(r.result ?? initialData());
    r.onerror = () => reject(r.error);
  });
}
export async function saveData(data: LabData) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("data", "readwrite");
    tx.objectStore("data").put(data, "lab");
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("保存失败：本地空间可能不足。请立即导出 JSON。"));
    tx.onabort = () => reject(new Error("本地保存中断，请导出 JSON。"));
  });
}
export function downloadJSON(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          { schemaVersion: 1, exportedAt: new Date().toISOString(), data },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
