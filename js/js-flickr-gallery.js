/** 
 * @projectDescription JsFlickrGallery - Simple JavaScript Flickr gallery, http://petejank.github.io/js-flickr-gallery/
 * 
 * @version 1.0.0
 * @author   Peter Jankowski http://likeadev.com
 * @license  MIT license.
 */
;(function ( $, window, document, undefined ) {
    'use strict';

    // "Constants"
    var FORMAT = 'json', 
        METHOD = 'flickr.photos.search', 
        API_KEY = '62525ee8c8d131d708d33d61f29434b6';

    // Plugin name declaration
    var pluginName = 'jsFlickrGallery', 
        defaults = {
            'fetchImages' : true,
            'animation' : 'fade',
            'animationSpeed' : 250,
            'preload' : { // false to disable
                'range' : 2
            }, 
            'structure' : { 
                'ulClass' : 'thumbnails',
                'liClass' : 'span1',
                'aClass' : 'thumbnail'
            },
            'modal' : { // false to disable
                'generate' : true,
                'id' : 'jsfg-modal',
                'title' : '.modal-header h3',
                'imageContainer' : '.modal-body .modal-image',
                'onContainerNext' : true,
                'imageFadeTime' : 250,
                'prev' : '.modal-prev',
                'next' : '.modal-next',
                'prevText' : 'Previous image',
                'nextText' : 'Next image',
                'offsetWidth' : 100,
                'offsetHeight' : 200
            },
            'pagination' : { // false to disable
                'generate' : true,
                'containerClass' : 'pagination',
                'prev' : '.pagination-prev',
                'next' : '.pagination-next',
                'prevText' : 'Previous page',
                'nextText' : 'Next page'
            },
            'loader' : { // false to disable
                'animation' : true,
                'text' : 'Loading',
                'interval' : 200,
                'mark' : '.',
                'maxMarks' : 3
            },
            'url' : {
                'per_page' : 30,
                'tagmode' : 'all',
                'user_id' : null,
                'tags' : null
            },
            'error' : {
                'text' : 'No photos found',
                'tagClass' : 'error'
            },
            'imageSizes' : {
                'small' : 's', // small (up to 75 x 75)
                'medium_100' : 't', // medium (up to 100 x 75)
                'medium' : 'q', // medium (up to 150 x 150)
                'medium_640' : 'z', // medium (up to 620 x 640)
                'large' : 'b', // large (up to 1024 in any of two dimensions)
                'original' : 'o' // original image size
            },
            'apiUrl' : 'http://api.flickr.com/services/rest/?jsoncallback=?',
            'setDefaultSize' : function() {
                this.thumbnailSize = this.imageSizes.medium;
                this.imageSize = this.imageSizes.large;   
            }
        };
    
    /**
     * Plugin constructor
     *
     * @param Object element
     * @param Object options
     * @return Plugin
     * @constructor
     */
    function Plugin( element, options ) {
        this.element = element;
        // Select this DOM element with jQuery - for future use
        this.$element = $( element );
        // Merge passed options with defaults
        this.options = $.extend(true, {}, defaults, options );
        
        // Set contexts for pagination and modal
        this.paginationContext = this.options.pagination && this.options.pagination.generate ? this.element : document;

        if ( !this.options.thumbnailSize && !this.options.imageSize ) { 
            this.options.setDefaultSize();
        }

        // Combine anchor selection string
        this.anchors = 'ul' + ( this.options.structure.ulClass ? '.' + 
                                this.options.structure.ulClass : null ) + 
                       ' li a' + ( this.options.structure.aClass ? '.' + 
                                this.options.structure.aClass : null );
        
        // Assign gallery instance id
        this.galleryId = this.element.id || Math.random().toString( 36 );
        // Starting page value
        this.page = 1;
        
        this.init();
    }
    
    // Define Plugin init method
    Plugin.prototype = {
        
        /**
         * Called at the end of the constructor. Creates gallery structure
         * for the node
         * 
         * @return void
         * @method
         * @memberOf Plugin
         */
        init : function() {
            if ( this.options.fetchImages ) {
                // Add gallery loader if available
                if ( this.options.loader ) {
                    this.loaderInterval = this._createLoader(this.$element);
                }
                
                this.createGallery(); // async, rest of the init code will be shot before this
            } else {
                // Assign anchors selector to local instance
                this.$anchors = $( this.anchors, this.$element );
            }
            
            if ( this.options.pagination && this.options.fetchImages ) {
                if ( this.options.pagination.generate ) {
                    this._createPagination();
                }
                
                this._bindPaginationEvents();
            }
            
            if ( this.options.modal ) {
                if ( this.options.modal.generate ) {
                    this._createModal();
                }
                
                this._bindModalEvents();
            }
            
        },
                
        /**
         * Get JSON image data using JSONP from flickr and create an gallery instance.
         * Does NOT clear the container content but appends to it
         * 
         * @param Integer page Starting pagination page
         * @return Plugin
         * @method
         * @memberOf Plugin
         */
        createGallery : function( page ) {
            // Assign constants to url options
            this.options.url.format = FORMAT;
            this.options.url.method = METHOD;
            this.options.url.api_key = API_KEY;

            // Set displayed page
            this.options.url.page = this.page = page || this.page;
            // Get tags for _this element
            this.options.url.tags = this.$element.attr('data-tags') || this.options.url.tags;
            // Check if only certain user photos should be fetched
            this.options.url.user_id = this.$element.attr('data-user-id') || this.options.url.user_id;
            if ( !this.options.url.user_id ) {
                delete this.options.url.user_id;
            }
            // How many photos should be fetched?
            this.options.url.per_page = this.$element.attr('data-per-page') || this.options.url.per_page;

            // Get images using ajax and display them on success
            this._getPhotos();

            return this;
        },
                
        /**
         * Hide gallery items and remove them
         * 
         * @param boolean loader
         * @return Plugin
         * @method
         * @memberOf Plugin
         */
        clearGallery : function( ) {
            var $galleryEl = $('ul.' + this.options.structure.ulClass, this.$element),  
                 _this = this;
            switch( this.options.animation ) 
            {
                case 'fade':
                    $galleryEl.fadeOut( this.options.animationSpeed, function() {
                        _replaceWithLoader();
                    });
                    break;
                case 'show':
                    $galleryEl.hide( this.options.animationSpeed, function() {
                        _replaceWithLoader();
                    });
                    break;
                case false:
                    $galleryEl.hide( 0 , function() {
                        _replaceWithLoader();
                    });
            }
            
            /**
             * Replace gallery content with loader
             *
             * @return void
             * @internal
             * @memberOf Plugin
             */
            function _replaceWithLoader() {
                if ( _this.options.loader ) {
                    _this.loaderInterval = _this._createLoader( _this.$element );
                }
                
                $galleryEl.remove();
            }
            
            return this;
        },
                
        /**
         * Check if current page is the last page of the gallery
         *
         * @return boolean
         * @method
         * @memberOf Plugin
         */
        isLastPage : function() {
            return this.$element.children( 'ul' ).find('li').length < this.options.url.per_page;
        },
                
        /**
         * Display next page of the gallery
         * 
         * @return Plugin | boolean False when current page is last one
         * @method
         * @memberOf Plugin
         */
        nextPage : function() {
            if ( !this.isLastPage() ) {
                return this.clearGallery().createGallery( this.page + 1 );
            } else {
                return false;
            }
        },
                
        /**
         * Display previous page of the gallery
         * 
         * @return Plugin | boolean False when page < 1
         * @method
         * @memberOf Plugin
         */
        prevPage : function() {
           if ( this.page > 1 ) {
               return this.clearGallery().createGallery( this.page - 1 );
           } else {
               return false;
           }
        },
                
        /**
         * Diplay previous gallery image in modal window
         * 
         * @return Plugin
         * @method
         * @memberOf Plugin
         */
        prevImage : function() {
            this.index -= 1;
            if (this.index < 0) {
                this.index = this.$anchors.length - 1;
            }
            
            return this._loadImage( false );
        },
                
        /**
         * Diplay next gallery image in modal window
         * 
         * @return Plugin
         * @method
         * @memberOf Plugin
         */
        nextImage : function() {
            this.index += 1;
            if ( this.index > this.$anchors.length - 1 ) {
                this.index = 0;
            }

            return this._loadImage( false );
        },
        
        /**
         * Fetch photos from Flickr
         * 
         * @return Plugin
         * @private
         * @memberOf Plugin
         */
        _getPhotos : function( ) {
            var _this = this;
            $.ajax({
                type: 'GET',
                url: _this.options.apiUrl,
                data: _this.options.url,
                dataType: 'jsonp',
                timeout: 10000
            }).done(function( data ) {
                 // Once data is returned, create gallery instance
                _this._renderGalleryContent( data.photos );
            }).always(function(data, textStatus) {
                // Try again
                if (textStatus === 'timeout') {
                    _this._getPhotos();    
                }
            });
        },
        
        /**
         * Create and render gallery instance. Not for public consumption. Not for public consumption
         * 
         * @param Array photos
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _renderGalleryContent : function( photos ) {
            var _this = this, 
                $images, 
                $ul, 
                listItems = '', 
                loadedImg = 0, 
                link, 
                title
               ;
                
            // Check if there's more than one gallery item returned
            if ( photos.photo.length > 0 ) {
                // Gallery is hidden by default for image loading purposes
                $ul = $( '<ul ' + ( _this.options.structure.ulClass ? 'class="' + _this.options.structure.ulClass + 
                            '"' : null ) + ' style="display: none">' );

                for ( var i = 0; i < photos.photo.length; i++ ) {
                    link = 'http://farm' + photos.photo[i].farm + 
                            '.static.flickr.com/' + photos.photo[i].server + '/' + photos.photo[i].id + '_' + 
                            photos.photo[i].secret + '_';
                    title = this._htmlEscape(photos.photo[i].title);
                    listItems += 
                        '<li ' + ( _this.options.structure.liClass ? 'class="' + 
                                    _this.options.structure.liClass + '"' : null ) + '>' + 
                            '<a href="' + link + _this.options.imageSize + '.jpg" title="' + title + 
                                '"' + ( _this.options.structure.aClass ? 'class="' + 
                                        _this.options.structure.aClass + '"' : null ) + '  target="_blank">' + 
                                '<img alt="' + title + '" src="' + link + 
                                            _this.options.thumbnailSize +
                                '.jpg"/>' + 
                            '</a>' + 
                    '</li>';
  
                }

                // Append thumbnails
                _this.$element.prepend( $ul.append( listItems ) );
                $images = $ul.find( 'img' );
                // Error handling
                $images.on( 'error', function() {
                    var $this = $( this ), 
                        src = $this.prop( 'src' );
                        
                    $this.prop( 'src', null ).prop( 'src', src );
                });
                // Attach load listener for thumbnails
                $images.on('load', function() {
                    loadedImg++;
                    if ( loadedImg === photos.photo.length ) {
                        // All images loaded, remove loader and display gallery content
                        _this._removeLoader( _this.$element );
                        // Check for entry animation switch
                        switch( _this.options.animation ) 
                        {
                            case 'fade':
                                $ul.fadeIn( _this.options.animationSpeed );
                                break;
                            case 'show':
                                $ul.show( _this.options.animationSpeed );
                                break;
                            case false:
                                $ul.show();
                        }
                        // Remove event listener
                        $images.off( 'load' ).off( 'error' );
                        // Assign anchors selector to local instance
                        _this.$anchors = $( _this.anchors, _this.$element );
                        // Toggle pagination
                        _this._togglePagination();
                    }
                });
            } else {
                _this.$element.prepend( '<span class="' + _this.options.error.tagClass + '">' + 
                                        _this.options.error.text + '</span>' );
                                
                _this._removeLoader( _this.$element )._togglePagination();
            }
            
            return _this;
        },
                
        /**
         * Escape special html characters. Not for public consumption
         * 
         * @return String str
         * @private
         * @method
         * @memberOf Plugin
         */
        _htmlEscape : function( str ) {
            return str
                    .replace( /&/g, '&amp;' )
                    .replace( /"/g, '&quot;' )
                    .replace( /'/g, '&#39;' )
                    .replace( /</g, '&lt;' )
                    .replace( />/g, '&gt;' );
        },
                
        /**
         * Enable and optionally generate pagination buttons (when pagination -> generated is true). 
         * Not for public consumption
         *
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _createPagination : function() {
            var pagination = '', 
                $prev = $( this.options.pagination.prev, this.paginationContext ), 
                $next = $( this.options.pagination.next, this.paginationContext )
              ;
             
            if ( $prev.length === 0 && $next.length === 0 && this.options.pagination.generate ) {
                pagination += '<div class="' + this.options.pagination.containerClass + '">' +
                                '<button ' + 'class="btn' + this.options.pagination.prev.replace( /\./g, ' ' ) + '" ' +
                                    'title="' + this.options.pagination.prevText + '" ' + 
                                    ( this.page === 1 ? 'disabled="disabled" ' : null ) + ' >&laquo;</button>' +
                                '<button ' + 'class="btn' + this.options.pagination.next.replace( /\./g, ' ' ) + '" ' + 
                                    'title="' + this.options.pagination.nextText + '" ' + 
                                    ( this.isLastPage() ? ' disabled="disabled" ' : null ) + '>&raquo;</button>' + 
                              '</div>';
                this.$element.append( pagination );
            }            
            
            return this;
        },
                
        /**
         * Bind modal pagination control events
         * 
         * @return Plugin
         * @private
         * @memberOf Plugin
         */
        _bindPaginationEvents : function() {
            var _this = this, 
                $prev = $( this.options.pagination.prev, this.paginationContext ), 
                $next = $( this.options.pagination.next, this.paginationContext )
              ;
              
            // Previous page action
            $prev.click(function() {
                if ( !$prev.is( ':disabled' ) ) {
                    $next.attr( 'disabled', 'disabled' );
                    $prev.attr( 'disabled', 'disabled' );
                    _this.prevPage();
                }
            });

            // Next page action
            $next.click(function() {
                if ( !$next.is( ':disabled' ) ) {
                    $prev.attr( 'disabled' , 'disabled' );
                    $next.attr( 'disabled', 'disabled' );
                    _this.nextPage();
                }
            });
        },
                
        /**
         * Toggles pagination buttons based on current page number. Not for public consumption
         *
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _togglePagination : function() {
            if ( this.page !== 1 ) {
                $( this.options.pagination.prev, this.paginationContext ).removeAttr( 'disabled' );
            } else {
                $( this.options.pagination.prev, this.paginationContext ).attr( 'disabled', 'disabled' );
            }
            
            if ( !this.isLastPage() ) {
                $( this.options.pagination.next, this.paginationContext ).removeAttr( 'disabled' );
            } else {
                $( this.options.pagination.next, this.paginationContext ).attr( 'disabled', 'disabled' );
            }
            
            return this;
        },
                
        /**
         * Bind modal event listeners and generate modal markup if required. Not for public consumption
         *
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _createModal : function() {
            // Check if modal structure is already available
            var header, 
                body, 
                footer
              ;
                                
            if ( $( '#' + this.options.modal.id ).length === 0 ) {
                header = '<div class="modal-header">' +
                            '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">' +
                            '&times;</button>' +
                            '<h3></h3>' +
                         '</div>',
                body = '<div class="modal-body">' + 
                            '<div class="modal-image"></div>' + 
                        '</div>',
                footer = '<div class="modal-footer">' +
                            '<button title="' + this.options.modal.prevText + 
                                '" class="btn' + this.options.modal.prev.replace(/\./g, ' ') + 
                                '">&laquo;</button>' +
                            '<button title="' + this.options.modal.nextText + 
                                '" class="btn btn-primary' + this.options.modal.next.replace(/\./g, ' ') + 
                                '">&raquo;</button>' +
                            '</div>';   

                // Append modal to body         
                $( 'body' ).append( '<div id="' + this.options.modal.id + 
                                    '" class="modal jsfg-modal hide fade">' + 
                                        header + body + footer + 
                                    '</div>' );
            }
            
            return this;
        },
                
        /**
         * Bind modal events to thumbnails and modal paging buttons
         * 
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _bindModalEvents : function() {
            var _this = this, 
                next = this.options.modal.onContainerNext ? this.options.modal.next + ', ' + 
                       this.options.modal.imageContainer : this.options.modal.next, 
                $modal, 
                context = '#' + this.options.modal.id
              ;
              
            // Bind on thumbnail click event
            this.$element.on( 'click', this.anchors, function( event ) {
                event.preventDefault();
                // Assign gallery id to modal window
                $( '#' + _this.options.modal.id ).attr( 'data-gallery-id', _this.galleryId );     
                // Also assign index to plugin instance
                _this.index = _this.$anchors.find( 'img' ).index( $( this ).find( 'img' ) );
                _this._loadImage( true );
            });
            
            $modal = $( '#' + _this.options.modal.id );
            
            // Next image in modal
            $( next, context ).click(function( event ) {
                event.preventDefault();
                // Check if this click listener should be triggered
                if ( $modal.attr( 'data-gallery-id' ) === _this.galleryId ) {
                    _this.nextImage();
                }
            });

            // Previous image in modal
            $( this.options.modal.prev, context ).click(function( event ) {
                event.preventDefault();
                // Check if this click listener should be triggered
                if ( $modal.attr( 'data-gallery-id' ) === _this.galleryId ) {
                    _this.prevImage();
                }
            });       
            
            return this;
        },
                
        /**
         * Load image in modal based on current index value stored in Plugin instance. Not for public consumption
         * 
         * @param boolean showModal Should modal be displayed?
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _loadImage : function( showModal ) {
            var _this = this, 
                $modal = $( '#' + this.options.modal.id ), 
                $modalTitle = $( this.options.modal.title, $modal ), 
                imageIndex = _this.index, 
                $imageAnchor = $( this.$anchors[ this.index ] ), 
                $image = $( '<img style="display: none" alt="' + $imageAnchor.attr( 'title' ) + 
                            '" src="' + $imageAnchor.attr('href') +  '"/>' ), 
                $imageContainer = $( this.options.modal.imageContainer, $modal ),
                $window = $( window )
              ;

            // Hide image container content
            $imageContainer.children().hide();
            if ( !$image[0].complete ) {
                // Start loading of clicked image in modal
                this.loaderInterval = this._createLoader( $imageContainer );
            } 
            
            // Set modal window title
            $modalTitle.text( $imageAnchor.attr( 'title' ) );
            // Show modal window if requested
            if ( showModal ) {
                $modal.modal( 'show' );
            }
            
            // Error handling
            $image.on( 'error', function() {
                $image.prop('src', null).prop('src', $imageAnchor.attr('href'));
            });
            
            // Wait for image to load
            $image.on( 'load', function() {
                // Check if image is already loading
                if ( _this.index === imageIndex ) {
                    // Clear all image container children BESIDE added image
                    $imageContainer.children().remove();
                    // Disable loader
                    _this._removeLoader( $imageContainer );
                    
                    // Resize image to fit box
                    $image = _this._resizeToFit( $image, $window );
                    $modalTitle.width( $image[0].width );
                    
                    // Resize image container to it's content
                    $imageContainer.height( $image[0].height ).width( $image[0].width );
                    
                    // Append image to image container
                    $image.appendTo( _this.options.modal.imageContainer );
                    
                    // If not responsive - center on both axes
                    if ( $window.width() > 767 ) {
                        $modal.css( 'top', '' );
                        ( $.support.transition ? $modal.animate : $modal.css ).call( $modal.stop(), {
                            'margin-left' : -$modal.outerWidth() / 2,
                            'margin-top' : -$modal.outerHeight() / 2
                        });
                    } else {
                        // ..center on y axis
                        $modal.css({
                            'top': ( $window.height() - $modal.outerHeight() ) / 2,
                            'margin-left' : '',
                            'margin-top' : ''
                        });
                    }
                    // Fade image in and center modal
                    $image.fadeIn( _this.options.modal.imageFadeTime );
                    // Cache near images
                    if ( _this.options.preload ) {
                        _this._preloadImages();
                    }
                    
                }
                
                $image.off('load').off('error');
            });
            
            return this;
        },
                
        /**
         * Image preload mechanism. Not for public consumption
         * 
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _preloadImages : function() {
            var maxIndex = this.index + this.options.preload.range + 1, 
                minIndex = this.index - this.options.preload.range, 
                anchor, 
                i
               ;
              
            for ( i = minIndex; i < maxIndex; i++ ) {
                anchor = this.$anchors[ i ];
                if ( anchor && i !== this.index ) {
                    $( document.createElement('img') ).prop( 'src', anchor.href || $( anchor ).attr( 'href' ) );
                }
            }
            
            return this;
        },
                
        /**
         * Resize image to fit screen. Not for public consumption
         *
         * @param Object $image 
         * @param Object $element
         * @return Object
         * @private
         * @method
         * @memberOf Plugin
         */
        _resizeToFit : function( $image, $element ) {
            var scale = 1, 
                maxWidth, 
                maxHeight
              ;
                
            // Scale image to fit page
            maxWidth = $element.width() - this.options.modal.offsetWidth;
            maxHeight = $element.height() - this.options.modal.offsetHeight;
            if ( $image[ 0 ].width > maxWidth || $image[ 0 ].height > maxHeight ) {
                scale = Math.min( maxWidth / $image[ 0 ].width, maxHeight / $image[ 0 ].height);
            } 

            $image[ 0 ].width *= scale;
            $image[ 0 ].height *= scale;
            
            return $image;
        },
                
        /**
         * Display loading message and create animation interval for marks if required. Not for public 
         * consumption
         * 
         * @param Object element
         * @return Object | boolean interval or true when animation disabled
         * @private
         * @method
         * @memberOf Plugin
         */
        _createLoader : function( $element ) {
            var $loaderMarks = $( '<span class="animation-marks"></span>' ), 
                options = this.options;
            
            // Add loader node to gallery container
            $element.prepend(
                $( '<p class="jsfg-loader">' + options.loader.text + '</span>' ).append( $loaderMarks )
            );

            if (options.loader.animation) {
                return setInterval(function() {
                    if ( $loaderMarks.text().length <= options.loader.maxMarks ) {
                        $loaderMarks.append( options.loader.mark );
                    } else {
                        $loaderMarks.text( '' );
                    }
                }, options.loader.interval );
            } else {
                return true;
            }
        },
                
        /**
         * Remove loader instance. Not for public consumption
         * 
         * @param Object $element
         * @return Plugin
         * @private
         * @method
         * @memberOf Plugin
         */
        _removeLoader : function( $element ) {
            if ( this.loaderInterval ) {
                $element.children( '.jsfg-loader' ).remove();
                clearInterval( this.loaderInterval );
            }
            
            return this;
        }
    };
    
    // Attach plugin to jQuery function pool
    $.fn[ pluginName ] = function ( options ) {
        return this.each( function () {
            if ( !$.data( this, "plugin_" + pluginName ) ) {
                $.data( this, "plugin_" + pluginName, new Plugin( this, options ) );
            }
        });
    };

    // Automatically attach jsFlickrGallery 
    $(function () {
        $( '[data-toggle="jsfg"]' ).jsFlickrGallery();
    });
    
})( jQuery, window, document );