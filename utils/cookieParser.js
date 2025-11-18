export function parseCookies(str = "") {
  const obj = {};
  str.split(";").forEach((c) => {
    const [k, v] = c.trim().split("=");
    if (k && v) obj[k] = decodeURIComponent(v);
  });
  return obj;
}