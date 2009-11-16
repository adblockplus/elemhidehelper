#!/usr/bin/perl

# This is a dummy, its purpose is to call a script with the same name in the buildtools repository

our $BRANCH_NAME = "ELEMENT_HIDING_HELPER";

$0 =~ s/(.*[\\\/])//g;
chdir($1) if $1;
do "buildtools/$0";
die $@ if $@;
