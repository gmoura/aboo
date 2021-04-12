const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const cookieParser = require('cookie-parser')

const scopes = [
  'ugc-image-upload',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'app-remote-control',
  'user-read-email',
  'user-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-read-private',
  'playlist-modify-private',
  'user-library-modify',
  'user-library-read',
  'user-top-read',
  'user-read-playback-position',
  'user-read-recently-played',
  'user-follow-read',
  'user-follow-modify'
];


// credentials are optional
const spotifyApi = new SpotifyWebApi({
  clientId: '',
  clientSecret: '',
  redirectUri: 'http://localhost:8888/callback',
});

const app = express();
const songToSearch = [];

app.use(cookieParser())

app.get('/', (req, res) => {
    if(isAuthenticated(req)) return res.send(songToSearch)
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
})

app.get('/callback', Auth, (req, res) => {
  getTracksBySlotys().then(data => {
    res.send({
      data : {
        items: data
      }
    });
  })
});
  
app.listen(8888, () =>
    console.log(
        'HTTP Server up. Now go to http://localhost:8888 in your browser.'
    )
);

function Auth (req, res, next) {
  const error = req.query.error;
  const code = req.query.code;
  const state = req.query.state;
  
  if(error) return console.error(error);

  if(isAuthenticated(req)) return next();

  spotifyApi
  .authorizationCodeGrant(code)
  .then(data => {
      const access_token = data.body['access_token'];
      const refresh_token = data.body['refresh_token'];
      const expires_in = data.body['expires_in'];

      res.cookie('code',code, { maxAge: 900000, httpOnly: true })
      spotifyApi.setAccessToken(access_token);
      spotifyApi.setRefreshToken(refresh_token);

      setInterval(async () => {
          const data = await spotifyApi.refreshAccessToken();
          const access_token = data.body['access_token'];
  
          console.log('The access token has been refreshed!');
          console.log('access_token:', access_token);
          spotifyApi.setAccessToken(access_token);
      }, expires_in / 2 * 1000);
  
      next();
  })
  .catch(error => {
      console.error('Error getting Tokens:', error);
      res.send(`Error getting Tokens: ${error}`);
    });

}

function getTracks ({ offset }) {
  return spotifyApi.getMySavedTracks({
    offset
  })
  .then(function(data) {
      return data.body
  },function(err) {
  console.log('Something went wrong!', err);
  });
}

function getTracksBySlotys (offset = songToSearch.length) {
  return getTracks({
    offset
  }).then(data => {
    const termsMapped = mapTermToSearch(data.items);
    termsMapped.forEach(element => {
      songToSearch.push(element)
    });

    if(songToSearch.length == data.total) {
      return songToSearch
    }
    return getTracksBySlotys()
  })
}

function mapTermToSearch(items) {
  return items.map(({ track }) => formatTerm(track));
}

function isAuthenticated ({ cookies }) {
  const hasCode = cookies ? (cookies.code || false) : false;
  return hasCode;
}

function formatTerm ({ name, artists }) {
  return (`${name} | ${ artists.map(song => song.name)}`);
}
