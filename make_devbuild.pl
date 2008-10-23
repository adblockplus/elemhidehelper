#!/usr/bin/perl

#############################################################################
# This script will create a development build of the extension. Without any #
# command line arguments it will include all available locales in the       #
# development build, command line arguments are interpreted as a list of    #
# locales to be included.                                                   #
#                                                                           #
# Creating a development build with all locales:                            #
#                                                                           #
#   perl make_devbuild.pl                                                   #
#                                                                           #
# Creating a development build with en-US locale only:                      #
#                                                                           #
#   perl make_devbuild.pl en-US                                             #
#                                                                           #
# Creating a development build with English, German and Russian locales:    #
#                                                                           #
#   perl make_devbuild.pl en-US de-DE ru-RU                                 #
#                                                                           #
#############################################################################

use strict;

open(VERSION, "version");
my $version = <VERSION>;
$version =~ s/[^\w\.]//gs;
close(VERSION);

my ($sec, $min, $hour, $day, $mon, $year) = localtime;
my $build = sprintf("%04i%02i%02i%02i", $year+1900, $mon+1, $day, $hour);

my $locale = (@ARGV ? "-" . join("-", @ARGV) : "");
@ARGV = ("elemhidehelper-$version+.$build$locale.xpi", "+.$build", @ARGV);
do './create_xpi.pl';
