/* Correspondance segment d'URL admin ↔ slug de page gérée.
   Les slugs sont des chemins ("/", "/tarifs") : la home devient
   le segment « accueil », les autres perdent leur "/" initial. */

export function segmentForSlug(slug: string): string {
  return slug === "/" ? "accueil" : slug.slice(1);
}

export function slugForSegment(segment: string): string {
  return segment === "accueil" ? "/" : `/${segment}`;
}
