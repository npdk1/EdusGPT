import { describeAntigravity } from "./antigravity";
import { PROVIDERS, type ProviderCredentials } from "./config";

/**
 * One readiness rule for every provider, so the request path never branches on
 * vendor just to decide "can this run yet?".
 *
 * Cloud backends need an API key. CLI backends need their binary: the Antigravity
 * login is a one-time interactive step, not a secret, so `configured` means
 * "the binary answers" rather than "a key exists".
 */
export type Readiness = { ok: true } | { ok: false; message: string };

export async function providerReadiness(
  creds: ProviderCredentials,
): Promise<Readiness> {
  const spec = PROVIDERS[creds.provider];
  if (spec.kind === "cli") {
    const status = await describeAntigravity();
    if (status.available) return { ok: true };
    return {
      ok: false,
      message:
        `${spec.label} chưa sẵn sàng: không tìm thấy lệnh \`agy\`. Chạy scripts/install-antigravity.ps1 rồi đăng nhập một lần bằng \`agy\`.`,
    };
  }
  if (creds.apiKey) return { ok: true };
  return {
    ok: false,
    message: `Chưa có ${spec.label} API key. Mở /setup để dán key của bạn.`,
  };
}

/** `null` when ready, otherwise a 428-shaped message for the browser. */
export async function credentialGate(
  creds: ProviderCredentials,
): Promise<string | null> {
  const readiness = await providerReadiness(creds);
  return readiness.ok ? null : readiness.message;
}