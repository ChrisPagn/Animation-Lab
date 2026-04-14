<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('webgpu'));            // landing / tout
Route::get('/loaders', fn () => view('webgpu-loaders'));
Route::get('/demos', fn () => view('webgpu-demos'));
Route::get('/transitions', fn () => view('webgpu-transitions'));
Route::get('/portfolio', fn () => view('webgpu-portfolio'));
