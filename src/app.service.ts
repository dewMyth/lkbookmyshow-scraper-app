import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Model } from 'mongoose';
import { Movie } from './schemas/movie.schema';
import { Cron } from '@nestjs/schedule';
import * as nodemailer from 'nodemailer';
import { Email } from './schemas/email.schema';

@Injectable()
export class AppService {
  constructor(
    @InjectModel(Movie.name) private movieModel: Model<Movie>,
    @InjectModel(Email.name) private emailModel: Model<Email>,
  ) {}

  @Cron('*/15 * * * *')
  async run() {
    try {
      console.log('Running scheduled task to scrape movies at ', new Date());
      // Step 1: Scrape movies
      const movies = await this.scarpeMovies();

      console.log(`Scraped ${movies?.length} movies at ${new Date()}`);

      // Step 2: Check for new movie additions
      const newlyAddmovies = await this.checkNewMovieAddition(movies);

      // If new movies are there, proceed to save and notify
      if (newlyAddmovies && newlyAddmovies.length > 0) {
        await this.saveToMongoDB(newlyAddmovies);
        // Step 3: Send email notification
        await this.sendEmailNotification(newlyAddmovies);
      } else {
        console.log('No new movies found or no movies scraped.');
      }
    } catch (error) {
      console.error('Error in run method:', error);
    }
  }

  async scarpeMovies() {
    try {
      let movies: any[] = [];

      const { data: html } = await axios.get(
        'https://lk.bookmyshow.com/sri-lanka/movies/nowshowing',
      ); // Replace with actual URL
      const $ = cheerio.load(html);

      // Step 1: Find the script block containing the impressions array
      const scriptTags = $('script').toArray();

      let impressionsRaw: string | null = null;

      for (const script of scriptTags) {
        const content = $(script).html();
        if (content && content.includes('"event":"productImpression"')) {
          // Step 2: Extract JSON manually using regex
          const match = content.match(
            /"event"\s*:\s*"productImpression"[\s\S]*?"impressions"\s*:\s*(\[[\s\S]*?\])\s*}/,
          );
          if (match && match[1]) {
            impressionsRaw = match[1];
            break;
          }
        }
      }

      if (!impressionsRaw) {
        console.error('Could not find impressions data.');
        return;
      }

      // Step 3: Safely parse the impressions array
      const impressions = JSON.parse(impressionsRaw);

      // Step 4: Display movie titles
      for (const movie of impressions) {
        movies.push(movie);
      }

      // Step 5: Return the movies array
      return movies;
    } catch (err) {
      console.error('Error:', err.message);
    }
  }

  async checkNewMovieAddition(scrapedMovies) {
    try {
      const newMovies: any[] = [];

      if (scrapedMovies && scrapedMovies.length > 0) {
        await Promise.all(
          scrapedMovies.map(async (scrapedMovie) => {
            const isFound = await this.movieModel.findOne({
              movie_id: scrapedMovie.id,
            });

            if (!isFound) {
              console.log(
                `New movie found: ${scrapedMovie.name} (${scrapedMovie.id})`,
              );
              newMovies.push(scrapedMovie);
            }
          }),
        );
      } else {
        console.log('No new movies found.');
      }

      return newMovies;
    } catch (error) {
      console.error('Error checking for new movie additions:', error);
    }
  }

  async saveToMongoDB(movies: any[]) {
    try {
      if (movies && movies.length > 0) {
        for (const movie of movies) {
          const newMovie = new this.movieModel({
            movie_id: movie.id,
            name: movie.name,
            variant: movie.variant,
            category: movie.category,
            position: movie.position,
            dimension13: movie.dimension13,
          });

          await newMovie.save();
          console.log(`Saved movie: ${movie.name} (${movie.id})`);
        }
      } else {
        console.log('No movies to save.');
      }
    } catch (error) {
      console.error('Error saving movies to MongoDB:', error);
    }
  }

  async sendEmailNotification(movies: any[]) {
    console.log(
      `Sending email notification for new movies started at : ${new Date()}`,
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      auth: {
        user: 'dewmyth.dev@gmail.com',
        pass: `${process.env.APP_PASSWORD}`,
      },
    });

    // Generate HTML content for the movies
    const movieRows = movies
      .map(
        (movie, index) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${movie.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${movie.variant}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${movie.category}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${movie.position}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${movie.dimension13}</td>
      </tr>`,
      )
      .join('');

    const htmlContent = `
  <div style="font-family: Arial, sans-serif; color: #333;">
    <h2 style="color: #4CAF50;">🎬 New Movie Notification</h2>
    <p>The following movie(s) have just been added to the system:</p>
    <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th style="padding: 8px; border: 1px solid #ddd;">#</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Name</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Variant</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Category</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Position</th>
          <th style="padding: 8px; border: 1px solid #ddd;">Dimension 13</th>
        </tr>
      </thead>
      <tbody>
        ${movieRows}
      </tbody>
    </table>
    <p style="margin-top: 20px;">📅 ${new Date().toLocaleString()}</p>
  </div>
`;

    // Get emails from the database
    const emailSubscriptions = await this.emailModel.find({}).lean().exec();
    if (!emailSubscriptions || emailSubscriptions.length === 0) {
      console.log('No email subscriptions found.');
      return;
    }

    const emailList = emailSubscriptions.map((email) => email.email).join(', ');

    console.log(
      `Found ${emailSubscriptions.length} email subscriptions.`,
      emailList,
    );

    // Constuct the email options
    const mailOptions = {
      from: '"LKBOOKMYSHOW Movie Bot 🎥" <dewmyth.dev@gmail.com>',
      to: emailList,
      subject: `🎞️ ${movies.length} New Movie(s) Added! | ${new Date()}`,
      text: `New movies added: ${movies.map((m) => m.name).join(', ')}`, // fallback text
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('Notification email sent: %s', info.messageId);
    return info.messageId;
  }

  async addNewEmailSubscription(email: string) {
    // Find user already exists
    const existingEmail = await this.movieModel.findOne({
      email: email,
    });

    if (existingEmail) {
      return { message: 'Email already exists in the subscription list.' };
    }

    // If not exists, create a new email subscription
    const newEmail = new this.emailModel({
      email: email,
      createdAt: new Date(),
    });

    const res = await newEmail.save();

    if (!res) {
      return { message: 'Failed to add email subscription.' };
    }

    return { message: `Email subscription - ${email} added successfully.` };
  }
}
