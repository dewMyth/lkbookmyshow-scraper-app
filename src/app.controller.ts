import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('run')
  runApp() {
    return this.appService.run();
  }

  @Get('scrape')
  scrapeMovies() {
    return this.appService.scrapeMovies();
  }

  @Post('add-email')
  addNewEmailSubscription(@Body() body: { email: string }) {
    return this.appService.addNewEmailSubscription(body.email);
  }
}
