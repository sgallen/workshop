export async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Unexpected ${response.headers.get('content-type') ?? 'response'} from server.`);
  }
}
