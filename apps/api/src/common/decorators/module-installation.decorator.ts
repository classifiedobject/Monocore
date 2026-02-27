import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MODULES = 'required_modules';
export const RequireInstalledModules = (...moduleKeys: string[]) => SetMetadata(REQUIRED_MODULES, moduleKeys);
