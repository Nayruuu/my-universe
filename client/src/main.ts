import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { installIosViewportZoomGuard } from './app/core/platform/ios-viewport-zoom';

installIosViewportZoomGuard(document, navigator);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
