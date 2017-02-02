/*---------------------------------------------------------------------------*\
 |  routes.js                                                                |
 |                                                                           |
 |  Copyright © 2016-2017, Rajiv Bakulesh Shah, original author.             |
 |                                                                           |
 |      This program is free software: you can redistribute it and/or modify |
 |      it under the terms of the GNU General Public License as published by |
 |      the Free Software Foundation, either version 3 of the License, or    |
 |      (at your option) any later version.                                  |
 |                                                                           |
 |      This program is distributed in the hope that it will be useful, but  |
 |      WITHOUT ANY WARRANTY; without even the implied warranty of           |
 |      MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU    |
 |      General Public License for more details.                             |
 |                                                                           |
 |      You should have received a copy of the GNU General Public License    |
 |      along with this program.  If not, see:                               |
 |          <http://www.gnu.org/licenses/>                                   |
\*---------------------------------------------------------------------------*/



import http from 'http';
import https from 'https';
import path from 'path';

import ReactDOMServer from 'react-dom/server';
import express from 'express';
import parallel from 'async/parallel';

import App from './src/index.jsx';

const router = express.Router();



let agent;
let apiHost;

if (process.env.NODE_ENV === 'production') {
    agent = https;
    apiHost = 'https://api.spool.tv';
} else {
    agent = http;
    apiHost = 'http://localhost:5000';
}



router.get(['/robots.txt', '/humans.txt'], (req, res) => {
    const url = `${apiHost}${req.path}`;
    agent.get(url, (apiResponse) => {
        let body = '';
        apiResponse.on('data', (chunk) => {
            body += chunk;
        });
        apiResponse.on('end', () => {
            res.type('text/plain');
            res.send(body);
        });
    });
});

router.get('/sitemap.xml', (req, res) => {
    const url = `${apiHost}/sitemap.xml`;
    agent.get(url, (apiResponse) => {
        let body = '';
        apiResponse.on('data', (chunk) => {
            body += chunk;
        });
        apiResponse.on('end', () => {
            const find = process.env.NODE_ENV == 'production' ? /https:\/\/api.spool.tv\//g : /http:\/\/localhost:5000\//g;
            const replace = process.env.NODE_ENV == 'production' ? 'https://spool.tv/' : 'http://localhost:8080/';
            body = body.replace(find, replace);
            body = body.replace(/\/v1\//g, '/');
            body = body.replace(/\/artists\//g, '/');
            body = body.replace(/\/songs\//g, '/');
            res.type('application/xml');
            res.send(body);
        });
    });
});

router.get('/gtfo', (req, res) => {
    const url = `${apiHost}/v1/gtfo`;
    res.redirect(url);
});

router.get('/', (req, res) => {
    const url = `${apiHost}/v1/songs`;
    agent.get(url, (apiResponse) => {
        let json = '';
        apiResponse.on('data', (chunk) => {
            json += chunk;
        });
        apiResponse.on('end', () => {
            const videos = JSON.parse(json).songs;
            const component = App({videos: videos});
            const rendered = ReactDOMServer.renderToString(component);
            res.render('index', {
                title: 'Spool - Just music videos.',
                app: rendered,
                videos: videos,
            });
        });
    });
});

router.get('/:artistId/:songId', (req, res, next) => {
    parallel({
        song: (callback) => {
            const url = `${apiHost}/v1/artists/${req.params.artistId}/songs/${req.params.songId}`;
            agent.get(url, (apiResponse) => {
                let json = '';
                apiResponse.on('data', (chunk) => {
                    json += chunk;
                });
                apiResponse.on('end', () => {
                    const video = JSON.parse(json).songs[0];
                    callback(null, video);
                });
            });
        },
        songs: (callback) => {
            const url = `${apiHost}/v1/songs`;
            agent.get(url, (apiResponse) => {
                let json = '';
                apiResponse.on('data', (chunk) => {
                    json += chunk;
                });
                apiResponse.on('end', () => {
                    const videos = JSON.parse(json).songs;
                    callback(null, videos);
                });
            });
        },
        genius: (callback) => {
            const url = `${apiHost}/v1/artists/${req.params.artistId}/songs/${req.params.songId}/genius`;
            agent.get(url, (apiResponse) => {
                let json = '';
                apiResponse.on('data', (chunk) => {
                    json += chunk;
                });
                apiResponse.on('end', () => {
                    try {
                        const description = JSON.parse(json).songs[0].description.plain;
                        callback(null, description);
                    } catch (e) {
                        callback(null, '');
                    }
                });
            });
        },
    },
    (err, results) => {
        try {
            const videos = [results.song].concat(results.songs);
            const component = App({videos: videos});
            const rendered = ReactDOMServer.renderToString(component);
            res.render('index', {
                title: `Spool - ${videos[0].artist} - ${videos[0].song}`,
                app: rendered,
                videos: videos,
            });
        } catch (err) {
            next(err);
        }
    });
});

router.use(express.static(__dirname + '/public'));

router.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});



export default router;