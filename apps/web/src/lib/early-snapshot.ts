/** Pages show the last weeks first; older history arrives right after, in the background.
 * 6 weeks: the 28-day chronic load weighs <5 % beyond that, and the full history follows seconds later. */
export const RECENT_DAYS = 42;

/**
 * Inline script (root layout) that starts the app pages' first snapshot request while the JavaScript is still
 * downloading, instead of after it: on a phone network that is most of the wait before the first paint.
 * The store uses it only when the window matches (`takeEarlySnapshot`); otherwise it asks again.
 */
export const EARLY_SNAPSHOT_SCRIPT = `(function(){
if(!/^\\/(coach|swimmer)(\\/|$)/.test(location.pathname))return;
var d=new Date();d.setDate(d.getDate()-${RECENT_DAYS});
var p=function(n){return String(n).padStart(2,"0")};
var s=d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
window.__aqEarlySnapshot={since:s,response:fetch("/api/v1/snapshot?since="+s,{credentials:"include",headers:{Accept:"application/json"}}).catch(function(){return null})};
})()`;

type Early = { since: string; response: Promise<Response | null> };

/** The early response for this window, once (later refreshes always ask the API). Null when unusable. */
export async function takeEarlySnapshot<T>(since: string): Promise<T | null> {
  const holder = window as unknown as { __aqEarlySnapshot?: Early };
  const early = holder.__aqEarlySnapshot;
  delete holder.__aqEarlySnapshot;
  if (!early || early.since !== since) return null;
  const response = await early.response;
  return response?.ok ? ((await response.json().catch(() => null)) as T | null) : null;
}
