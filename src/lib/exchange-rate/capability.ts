export function resolveAutoFxCapability(settings: any | undefined | null) {
  const schemaAvailable = typeof settings?.auto_fx_enabled === 'boolean';
  return {
    schemaAvailable,
    enabled: schemaAvailable ? !!settings.auto_fx_enabled : false
  };
}
